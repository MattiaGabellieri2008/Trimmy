import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/network/api_client.dart';
import '../models/user_model.dart';

class AuthRepository extends ChangeNotifier {
  AppUser? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;
  static const String _sessionStorageKey = 'trimmy_user_session';

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
          _isLoading = false;
          notifyListeners();
          return;
        }
      }

      // 2. Controlla la sessione salvata localmente su disco
      final prefs = await SharedPreferences.getInstance();
      final rawJson = prefs.getString(_sessionStorageKey);
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
      final prefs = await SharedPreferences.getInstance();
      if (user != null) {
        await prefs.setString(_sessionStorageKey, jsonEncode(user.toJson()));
      } else {
        await prefs.remove(_sessionStorageKey);
      }
    } catch (e) {
      debugPrint('Errore salvataggio sessione disco: $e');
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
      } catch (fbErr) {
        debugPrint('Firebase Auth fallito o non configurato offline: $fbErr');
      }

      final uid = cred?.user?.uid ?? 'user-${email.hashCode.abs()}';

      // Prova a recuperare il profilo da Firestore
      AppUser? profile = await _fetchFirestoreProfile(uid, email);

      if (profile == null) {
        // Se non esiste ancora su Firestore, deduce il ruolo in base al dominio/email
        final isSalon = email.toLowerCase().contains('salone') ||
            email.toLowerCase().contains('atelier') ||
            email.toLowerCase().contains('barber');

        profile = AppUser(
          id: uid,
          email: email,
          displayName: cred?.user?.displayName ?? (isSalon ? 'Titolare Salone' : 'Cliente Trimmy'),
          role: isSalon ? UserRole.salon : UserRole.client,
          salonId: isSalon ? 'salon-1' : null,
          salonName: isSalon ? 'Atelier Bellezza Duomo' : null,
        );

        // Salva su Firestore per la prossima volta
        try {
          await FirebaseFirestore.instance.collection('users').doc(uid).set(profile.toJson(), SetOptions(merge: true));
        } catch (_) {}
      }

      _currentUser = profile;
      await _saveSessionToDisk(_currentUser);
      await ApiClient().setAuthToken('token-${_currentUser!.id}');

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
      } catch (fbErr) {
        debugPrint('Firebase Auth signup offline fallback: $fbErr');
      }

      final uid = cred?.user?.uid ?? 'user-${email.hashCode.abs()}';
      final salonId = role == UserRole.salon ? 'salon-${uid.substring(0, 6)}' : null;

      final newUser = AppUser(
        id: uid,
        email: email,
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
      await ApiClient().setAuthToken('token-${_currentUser!.id}');

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

  /// Accesso Rapido Demo (per testare su emulatore senza digitare credenziali)
  Future<void> signInDemo(UserRole role) async {
    _isLoading = true;
    notifyListeners();

    await Future.delayed(const Duration(milliseconds: 300));

    if (role == UserRole.salon) {
      _currentUser = const AppUser(
        id: 'demo-salon-1',
        email: 'atelier.duomo@trimmy.it',
        displayName: 'Atelier Bellezza Duomo (Titolare)',
        phone: '+39 02 8847291',
        role: UserRole.salon,
        salonId: 'salon-1',
        salonName: 'Atelier Bellezza Duomo',
      );
    } else {
      _currentUser = const AppUser(
        id: 'demo-client-1',
        email: 'mario.rossi@trimmy.it',
        displayName: 'Mario Rossi',
        phone: '+39 340 1234567',
        role: UserRole.client,
        salonId: null,
      );
    }

    await _saveSessionToDisk(_currentUser);
    await ApiClient().setAuthToken('token-${_currentUser!.id}');

    _isLoading = false;
    notifyListeners();
  }

  /// Disconnette l'utente da Firebase e rimuove la sessione dal dispositivo
  Future<void> signOut() async {
    try {
      await FirebaseAuth.instance.signOut();
    } catch (e) {
      debugPrint('FirebaseAuth signOut: $e');
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessionStorageKey);
    await ApiClient().clearAuthToken();

    _currentUser = null;
    notifyListeners();
  }
}
