import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/network/api_client.dart';
import '../models/user_model.dart';

class AuthRepository extends ChangeNotifier {
  AppUser? _currentUser;
  bool _isLoading = false;
  static const String _sessionStorageKey = 'trimmy_user_session';

  AppUser? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;
  bool get isLoading => _isLoading;

  AuthRepository() {
    _initSession();
  }

  /// Recupera la sessione salvata localmente su disco
  Future<void> _initSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final rawJson = prefs.getString(_sessionStorageKey);
      if (rawJson != null && rawJson.isNotEmpty) {
        final decoded = jsonDecode(rawJson) as Map<String, dynamic>;
        _currentUser = AppUser.fromJson(decoded);
        notifyListeners();
        return;
      }
    } catch (e) {
      debugPrint('Nota ripristino sessione disco: $e');
    }

    // Default demo session se prima installazione
    _currentUser = const AppUser(
      id: 'demo-client-1',
      email: 'mario.rossi@trimmy.it',
      displayName: 'Mario Rossi',
      phone: '+39 340 1234567',
      role: UserRole.client,
      salonId: 'salon-1',
    );
    _saveSessionToDisk(_currentUser);
    notifyListeners();
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

  Future<void> signInWithEmailPassword(String email, String password) async {
    _isLoading = true;
    notifyListeners();

    await Future.delayed(const Duration(milliseconds: 600));

    // Riconoscimento intelligente del ruolo in base all'email
    if (email.contains('salone') || email.contains('atelier') || email.contains('barber')) {
      _currentUser = AppUser(
        id: 'salon-owner-1',
        email: email,
        displayName: 'Atelier Duomo (Titolare)',
        phone: '+39 02 8847291',
        role: UserRole.salon,
        salonId: 'salon-1',
      );
    } else {
      _currentUser = AppUser(
        id: 'client-user-1',
        email: email,
        displayName: 'Mario Rossi',
        phone: '+39 340 1234567',
        role: UserRole.client,
        salonId: 'salon-1',
      );
    }

    await _saveSessionToDisk(_currentUser);
    await ApiClient().setAuthToken('token-${_currentUser!.id}');

    _isLoading = false;
    notifyListeners();
  }

  void switchRole(UserRole newRole) {
    if (_currentUser == null) return;
    if (newRole == UserRole.salon) {
      _currentUser = AppUser(
        id: _currentUser!.id,
        email: _currentUser!.email,
        displayName: 'Atelier Duomo (Titolare)',
        phone: _currentUser!.phone,
        role: UserRole.salon,
        salonId: 'salon-1',
      );
    } else {
      _currentUser = AppUser(
        id: _currentUser!.id,
        email: _currentUser!.email,
        displayName: 'Mario Rossi',
        phone: _currentUser!.phone,
        role: UserRole.client,
        salonId: 'salon-1',
      );
    }
    _saveSessionToDisk(_currentUser);
    notifyListeners();
  }

  Future<void> signOut() async {
    _currentUser = null;
    await _saveSessionToDisk(null);
    await ApiClient().setAuthToken(null);
    notifyListeners();
  }
}
