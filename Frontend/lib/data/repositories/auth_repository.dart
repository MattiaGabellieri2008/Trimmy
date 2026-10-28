import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/user_model.dart';

class AuthRepository extends ChangeNotifier {
  AppUser? _currentUser;
  bool _isLoading = false;

  AppUser? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;
  bool get isLoading => _isLoading;

  AuthRepository() {
    // Default demo session per esplorazione rapida
    _currentUser = const AppUser(
      id: 'demo-client-1',
      email: 'mario.rossi@trimmy.it',
      displayName: 'Mario Rossi',
      phone: '+39 340 1234567',
      role: UserRole.client,
      salonId: 'salon-1',
    );
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
    notifyListeners();
  }

  void signOut() {
    _currentUser = null;
    notifyListeners();
  }
}
