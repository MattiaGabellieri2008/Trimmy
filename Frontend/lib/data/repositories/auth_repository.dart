import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/secure_storage_service.dart';
import '../models/user_model.dart';

class AuthRepository extends ChangeNotifier {
  AppUser? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;
  static const String _sessionStorageKey = 'trimmy_user_session';

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
    serverClientId: '274369523001-2piskemepmkbpq8arnuqrafih0s408lq.apps.googleusercontent.com',
  );

  AppUser? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  AuthRepository() {
    _initSession();
  }

  /// Inizializza la sessione all'avvio controllando Firebase Auth e il disco
  Future<void> _initSession() async {
    _isLoading = true;
    notifyListeners();

    try {
      // 1. Controlla prima se c'è un utente attivo in FirebaseAuth
      final fbUser = FirebaseAuth.instance.currentUser;
      if (fbUser != null) {
        final profile = await _fetchFirestoreProfile(fbUser.uid, fbUser.email ?? '');
        if (profile != null) {
          _currentUser = profile;
          await _saveSessionToDisk(_currentUser);
          try {
            final idToken = await fbUser.getIdToken();
            await ApiClient().setAuthToken(idToken);
          } catch (_) {}
          _isLoading = false;
          notifyListeners();
          return;
        }
      }

      // 2. Controlla la sessione salvata localmente su storage sicuro hardware (Keystore/Keychain)
      final rawJson = await SecureStorageService().readSecure(_sessionStorageKey);
      if (rawJson != null && rawJson.isNotEmpty) {
        final decoded = jsonDecode(rawJson) as Map<String, dynamic>;
        _currentUser = AppUser.fromJson(decoded);
        _isLoading = false;
        notifyListeners();
        return;
      }
    } catch (e) {
      debugPrint('Nota ripristino sessione: $e');
    }

    // Se non c'è nessuna sessione valida, l'utente NON è autenticato -> mostrerà LoginScreen
    _currentUser = null;
    _isLoading = false;
    notifyListeners();
  }

  Future<AppUser?> _fetchFirestoreProfile(String uid, String email) async {
    try {
      final doc = await FirebaseFirestore.instance.collection('users').doc(uid).get();
      if (doc.exists && doc.data() != null) {
        final data = doc.data()!;
        data['id'] = uid;
        return AppUser.fromJson(data);
      }
    } catch (e) {
      debugPrint('Firestore profile fetch fallback: $e');
    }
    return null;
  }

  Future<void> _saveSessionToDisk(AppUser? user) async {
    try {
      if (user != null) {
        await SecureStorageService().writeSecure(_sessionStorageKey, jsonEncode(user.toJson()));
      } else {
        await SecureStorageService().deleteSecure(_sessionStorageKey);
      }
    } catch (e) {
      debugPrint('Errore salvataggio protetto sessione: $e');
    }
  }

  /// Login con Email & Password (Firebase Auth + Firestore)
  Future<bool> signInWithEmailPassword(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      UserCredential? cred;
      try {
        cred = await FirebaseAuth.instance.signInWithEmailAndPassword(
          email: email.trim(),
          password: password,
        );
      } on FirebaseAuthException catch (fbErr) {
        debugPrint('FirebaseAuthException durante il login: ${fbErr.code} - ${fbErr.message}');
        String userFriendlyMsg = 'Errore di autenticazione.';
        switch (fbErr.code) {
          case 'user-not-found':
            userFriendlyMsg = 'Nessun account registrato con questo indirizzo email.';
            break;
          case 'wrong-password':
          case 'invalid-credential':
            userFriendlyMsg = 'Password errata o credenziali non corrette. Riprova.';
            break;
          case 'invalid-email':
            userFriendlyMsg = 'Il formato dell\'indirizzo email non è valido.';
            break;
          case 'user-disabled':
            userFriendlyMsg = 'Questo account è stato disabilitato per motivi di sicurezza.';
            break;
          case 'too-many-requests':
            userFriendlyMsg = 'Troppi tentativi falliti consecutivi. Attendi qualche minuto prima di riprovare.';
            break;
          case 'network-request-failed':
            // Se la rete è offline, controlla se su storage protetto è presente una sessione valida di questo utente
            final rawJson = await SecureStorageService().readSecure(_sessionStorageKey);
            if (rawJson != null && rawJson.isNotEmpty) {
              final decoded = jsonDecode(rawJson) as Map<String, dynamic>;
              if ((decoded['email'] as String?)?.toLowerCase() == email.trim().toLowerCase()) {
                _currentUser = AppUser.fromJson(decoded);
                _isLoading = false;
                notifyListeners();
                return true;
              }
            }
            userFriendlyMsg = 'Nessuna connessione a Internet disponibile. Riprova con la connessione attiva.';
            break;
          default:
            userFriendlyMsg = fbErr.message ?? 'Impossibile accedere con queste credenziali.';
        }
        _errorMessage = userFriendlyMsg;
        _isLoading = false;
        notifyListeners();
        return false;
      } catch (err) {
        _errorMessage = 'Errore durante il tentativo di accesso: $err';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      if (cred.user == null) {
        _errorMessage = 'Credenziali di accesso non valide.';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      final uid = cred.user!.uid;

      // Recupera il profilo reale da Firestore
      AppUser? profile = await _fetchFirestoreProfile(uid, email);

      if (profile == null) {
        profile = AppUser(
          id: uid,
          email: email.trim(),
          displayName: cred.user?.displayName ?? 'Utente Trimmy',
          role: UserRole.client,
        );
        try {
          await FirebaseFirestore.instance.collection('users').doc(uid).set(profile.toJson(), SetOptions(merge: true));
        } catch (_) {}
      }

      _currentUser = profile;
      await _saveSessionToDisk(_currentUser);
      
      try {
        final idToken = await cred.user?.getIdToken();
        await ApiClient().setAuthToken(idToken);
      } catch (_) {}

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Registrazione nuovo utente con selezione Ruolo (Cliente o Salone)
  Future<bool> signUpWithEmailPassword({
    required String email,
    required String password,
    required String displayName,
    required String phone,
    required UserRole role,
    String? salonName,
    String? address,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      UserCredential? cred;
      try {
        cred = await FirebaseAuth.instance.createUserWithEmailAndPassword(
          email: email.trim(),
          password: password,
        );
        await cred.user?.updateDisplayName(displayName);
      } on FirebaseAuthException catch (fbErr) {
        debugPrint('FirebaseAuthException durante registrazione: ${fbErr.code} - ${fbErr.message}');
        String userMsg = 'Errore durante la registrazione.';
        switch (fbErr.code) {
          case 'email-already-in-use':
            userMsg = 'Un account con questo indirizzo email è già registrato. Accedi con le tue credenziali.';
            break;
          case 'weak-password':
            userMsg = 'La password scelta è troppo debole. Inserisci almeno 6 caratteri alfanumerici.';
            break;
          case 'invalid-email':
            userMsg = 'Il formato dell\'indirizzo email non è valido.';
            break;
          case 'operation-not-allowed':
            userMsg = 'Registrazione con email temporaneamente disabilitata.';
            break;
          default:
            userMsg = fbErr.message ?? 'Impossibile completare la registrazione.';
        }
        _errorMessage = userMsg;
        _isLoading = false;
        notifyListeners();
        return false;
      } catch (err) {
        _errorMessage = 'Errore imprevisto durante la registrazione: $err';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      if (cred.user == null) {
        _errorMessage = 'Impossibile creare l\'utente su Firebase Auth.';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      final uid = cred.user!.uid;
      final salonId = role == UserRole.salon ? 'salon-${uid.substring(0, 6)}' : null;

      final newUser = AppUser(
        id: uid,
        email: email.trim(),
        displayName: displayName,
        phone: phone,
        role: role,
        salonId: salonId,
        salonName: salonName,
      );

      // Salva profilo su Cloud Firestore
      try {
        await FirebaseFirestore.instance.collection('users').doc(uid).set({
          'uid': uid,
          'email': email,
          'name': displayName,
          'phone': phone,
          'role': role == UserRole.salon ? 'salone' : 'cliente',
          'salonId': salonId,
          'salonName': salonName,
          'address': address,
          'createdAt': FieldValue.serverTimestamp(),
        });

        // Se Salone, registra anche il documento del salone in /saloni
        if (role == UserRole.salon && salonId != null) {
          await FirebaseFirestore.instance.collection('saloni').doc(salonId).set({
            'id': salonId,
            'name': salonName ?? displayName,
            'ownerUid': uid,
            'address': address ?? 'Indirizzo Salone',
            'city': 'Milano',
            'phone': phone,
            'category': 'Hair Stylist',
            'rating': 5.0,
            'reviewCount': 0,
            'createdAt': FieldValue.serverTimestamp(),
          }, SetOptions(merge: true));
        }
      } catch (fsErr) {
        debugPrint('Firestore write error durante registrazione: $fsErr');
      }

      _currentUser = newUser;
      await _saveSessionToDisk(_currentUser);
      try {
        final idToken = await cred.user?.getIdToken();
        await ApiClient().setAuthToken(idToken);
      } catch (_) {}

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Accesso con Google Reale (GoogleSignIn nativo Android/iOS + Firebase Auth + Firestore)
  Future<bool> signInWithGoogle({UserRole? selectedRole, String? salonName, String? address}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // 1. Forza la disconnessione della sessione Google precedente per aprire sempre il selettore account
      try {
        await _googleSignIn.signOut();
      } catch (e) {
        debugPrint('GoogleSignIn signOut note: $e');
      }

      // 2. Apre il selettore nativo degli account Google presenti sul dispositivo
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();

      if (googleUser == null) {
        // L'utente ha chiuso il popup / annullato la selezione
        _isLoading = false;
        notifyListeners();
        return false;
      }

      // 3. Recupera i token crittografici di autenticazione da Google (idToken, accessToken)
      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;

      // 4. Crea la credenziale OAuth compatibile con Firebase
      final OAuthCredential credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // 5. Autentica su Firebase Auth con la vera credenziale Google
      final UserCredential userCredential = await FirebaseAuth.instance.signInWithCredential(credential);
      final User? fbUser = userCredential.user;

      if (fbUser == null) {
        throw Exception('Impossibile completare l\'autenticazione con Firebase Auth.');
      }

      final uid = fbUser.uid;
      final email = fbUser.email ?? googleUser.email;
      final displayName = fbUser.displayName ?? googleUser.displayName ?? (selectedRole == UserRole.salon ? 'Titolare Google' : 'Cliente Google');

      // 6. Cerca se questo utente Google ha già un profilo su Cloud Firestore
      AppUser? profile = await _fetchFirestoreProfile(uid, email);

      if (profile == null) {
        // Primo accesso: registra il profilo su Firestore con il ruolo scelto
        final effectiveRole = selectedRole ?? UserRole.client;
        final salonId = effectiveRole == UserRole.salon ? 'salon-${uid.substring(0, 6)}' : null;

        profile = AppUser(
          id: uid,
          email: email,
          displayName: displayName,
          phone: fbUser.phoneNumber ?? '+39 333 0000000',
          role: effectiveRole,
          salonId: salonId,
          salonName: effectiveRole == UserRole.salon ? (salonName ?? 'Salone $displayName') : null,
        );

        // Salva su Cloud Firestore in users/{uid}
        try {
          await FirebaseFirestore.instance.collection('users').doc(uid).set({
            'uid': uid,
            'email': email,
            'name': displayName,
            'phone': profile.phone,
            'role': effectiveRole == UserRole.salon ? 'salone' : 'cliente',
            'salonId': salonId,
            'salonName': profile.salonName,
            'address': address,
            'photoUrl': fbUser.photoURL ?? googleUser.photoUrl,
            'createdAt': FieldValue.serverTimestamp(),
          }, SetOptions(merge: true));

          if (effectiveRole == UserRole.salon && salonId != null) {
            await FirebaseFirestore.instance.collection('saloni').doc(salonId).set({
              'id': salonId,
              'name': profile.salonName ?? displayName,
              'ownerUid': uid,
              'address': address ?? 'Via Roma 1, Milano',
              'city': 'Milano',
              'phone': profile.phone,
              'category': 'Hair Stylist',
              'rating': 5.0,
              'createdAt': FieldValue.serverTimestamp(),
            }, SetOptions(merge: true));
          }
        } catch (fsErr) {
          debugPrint('Firestore save error durante Google login: $fsErr');
        }
      }

      _currentUser = profile;
      await _saveSessionToDisk(_currentUser);
      try {
        final idToken = await fbUser.getIdToken();
        await ApiClient().setAuthToken(idToken);
      } catch (_) {}

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Errore durante Google Sign In nativo: $e');
      _errorMessage = 'Accesso Google fallito: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Accesso Rapido Demo (per testare su emulatore senza digitare credenziali)
  Future<void> signInDemo(UserRole role) async {
    _isLoading = true;
    notifyListeners();

    await Future.delayed(const Duration(milliseconds: 300));

    if (role == UserRole.salon) {
      _currentUser = const AppUser(
        id: 'salon-owner-1',
        email: 'salone@trimmy.it',
        displayName: 'Titolare Salone',
        phone: '',
        role: UserRole.salon,
        salonId: 'salon-1',
        salonName: 'Salone Partner Trimmy',
      );
    } else {
      _currentUser = const AppUser(
        id: 'client-user-1',
        email: 'cliente@trimmy.it',
        displayName: 'Cliente',
        phone: '',
        role: UserRole.client,
        salonId: null,
      );
    }

    await _saveSessionToDisk(_currentUser);
    await ApiClient().setAuthToken('token-${_currentUser!.id}');

    _isLoading = false;
    notifyListeners();
  }

  /// Aggiorna i dati del salone nel profilo utente attivo
  Future<void> updateSalonData({
    required String salonName,
    String? photoUrl,
    String? imageUrl,
    String? phone,
    String? address,
    String? city,
    String? category,
  }) async {
    if (_currentUser == null) return;
    _currentUser = AppUser(
      id: _currentUser!.id,
      email: _currentUser!.email,
      displayName: salonName,
      phone: phone ?? _currentUser!.phone,
      role: _currentUser!.role,
      salonId: _currentUser!.salonId ?? _currentUser!.id,
      salonName: salonName,
      photoUrl: photoUrl ?? imageUrl ?? _currentUser!.photoUrl,
    );
    await _saveSessionToDisk(_currentUser);
    notifyListeners();
  }

  /// Disconnette l'utente da Firebase e rimuove la sessione dal dispositivo
  Future<void> signOut() async {
    try {
      await FirebaseAuth.instance.signOut();
    } catch (e) {
      debugPrint('FirebaseAuth signOut: $e');
    }

    try {
      await _googleSignIn.signOut();
    } catch (_) {}

    await SecureStorageService().deleteSecure(_sessionStorageKey);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessionStorageKey);
    await ApiClient().clearAuthToken();

    _currentUser = null;
    notifyListeners();
  }

  /// Eliminazione Definitiva Account ("Diritto all'Oblio" - GDPR Art. 17 / Compliance Google & Apple)
  Future<bool> deleteAccount() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final fbUser = FirebaseAuth.instance.currentUser;
      final uid = fbUser?.uid ?? _currentUser?.id;

      if (uid != null && uid.isNotEmpty) {
        // 1. Anonimizzazione / eliminazione dati anagrafici dal documento Firestore /users/{uid}
        try {
          await FirebaseFirestore.instance.collection('users').doc(uid).delete();
        } catch (e) {
          debugPrint('Nota cancellazione /users/$uid: $e');
        }

        // 2. Se Salone, elimina o disattiva il salone
        if (_currentUser?.role == UserRole.salon && _currentUser?.salonId != null) {
          try {
            await FirebaseFirestore.instance.collection('saloni').doc(_currentUser!.salonId).delete();
          } catch (e) {
            debugPrint('Nota cancellazione salone: $e');
          }
        }

        // 3. Eliminazione da Firebase Authentication
        if (fbUser != null) {
          try {
            await fbUser.delete();
          } on FirebaseAuthException catch (authErr) {
            if (authErr.code == 'requires-recent-login') {
              _errorMessage = 'Per motivi di sicurezza, effettua nuovamente l\'accesso prima di procedere all\'eliminazione definitiva dell\'account.';
              _isLoading = false;
              notifyListeners();
              return false;
            }
            debugPrint('FirebaseAuth delete note: $authErr');
          }
        }
      }

      // 4. Pulizia hardware di tutti i token e preferenze
      await SecureStorageService().clearAll();
      await ApiClient().clearAuthToken();

      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_sessionStorageKey);

      _currentUser = null;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Errore durante l\'eliminazione dell\'account: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }
}
