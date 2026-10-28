import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/fidelity_model.dart';

class FidelityRepository extends ChangeNotifier {
  static const String _loyaltyStorageKey = 'trimmy_fidelity_loyalty';
  static const String _packagesStorageKey = 'trimmy_fidelity_packages';

  CustomerLoyalty _clientLoyalty = CustomerLoyalty.fromPoints('demo-client-1', 180, 240);
  final List<CustomerPackage> _clientPackages = [];

  CustomerLoyalty get clientLoyalty => _clientLoyalty;
  List<CustomerPackage> get clientPackages => _clientPackages;

  FidelityRepository() {
    _loadFromDisk();
  }

  Future<void> _loadFromDisk() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      
      // Carica saldo punti
      final rawLoyalty = prefs.getString(_loyaltyStorageKey);
      if (rawLoyalty != null && rawLoyalty.isNotEmpty) {
        final decoded = jsonDecode(rawLoyalty) as Map<String, dynamic>;
        _clientLoyalty = CustomerLoyalty.fromJson(decoded);
      }

      // Carica pacchetti carnet
      final rawPackages = prefs.getString(_packagesStorageKey);
      if (rawPackages != null && rawPackages.isNotEmpty) {
        final decoded = jsonDecode(rawPackages) as List<dynamic>;
        _clientPackages.clear();
        _clientPackages.addAll(decoded.map((item) => CustomerPackage.fromJson(item as Map<String, dynamic>)));
        notifyListeners();
        return;
      }
    } catch (e) {
      debugPrint('Nota ripristino fidelity disco: $e');
    }

    // Default seed per primo avvio
    _clientPackages.addAll([
      CustomerPackage(
        id: 'cpkg-1',
        packageName: 'Carnet Piega 5 + 1 Omaggio',
        serviceName: 'Piega & Styling Glamour',
        totalSessions: 6,
        remainingSessions: 4,
        expiryDate: DateTime.now().add(const Duration(days: 120)),
        status: 'ACTIVE',
      ),
      CustomerPackage(
        id: 'cpkg-2',
        packageName: 'Pacchetto Barba Ritual 3 + 1',
        serviceName: 'Rasatura Tradizionale & Panno Caldo',
        totalSessions: 4,
        remainingSessions: 2,
        expiryDate: DateTime.now().add(const Duration(days: 90)),
        status: 'ACTIVE',
      ),
    ]);
    _saveToDisk();
    notifyListeners();
  }

  Future<void> _saveToDisk() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_loyaltyStorageKey, jsonEncode(_clientLoyalty.toJson()));
      await prefs.setString(_packagesStorageKey, jsonEncode(_clientPackages.map((p) => p.toJson()).toList()));
    } catch (e) {
      debugPrint('Errore salvataggio fidelity su disco: $e');
    }
  }

  Future<void> awardPoints(int points) async {
    final newPoints = _clientLoyalty.pointsBalance + points;
    final newTotal = _clientLoyalty.totalPointsEarned + points;
    _clientLoyalty = CustomerLoyalty.fromPoints(_clientLoyalty.customerId, newPoints, newTotal);
    await _saveToDisk();
    notifyListeners();
  }

  Future<bool> redeemPoints(int points) async {
    if (_clientLoyalty.pointsBalance < points) return false;
    final newPoints = _clientLoyalty.pointsBalance - points;
    _clientLoyalty = CustomerLoyalty.fromPoints(
      _clientLoyalty.customerId,
      newPoints,
      _clientLoyalty.totalPointsEarned,
    );
    await _saveToDisk();
    notifyListeners();
    return true;
  }

  Future<bool> usePackageSession(String packageId) async {
    final index = _clientPackages.indexWhere((p) => p.id == packageId);
    if (index != -1 && _clientPackages[index].remainingSessions > 0) {
      final current = _clientPackages[index];
      final remaining = current.remainingSessions - 1;
      _clientPackages[index] = CustomerPackage(
        id: current.id,
        packageName: current.packageName,
        serviceName: current.serviceName,
        totalSessions: current.totalSessions,
        remainingSessions: remaining,
        expiryDate: current.expiryDate,
        status: remaining == 0 ? 'EXHAUSTED' : 'ACTIVE',
      );
      await _saveToDisk();
      notifyListeners();
      return true;
    }
    return false;
  }
}
