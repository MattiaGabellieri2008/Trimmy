import 'package:flutter/foundation.dart';
import '../models/fidelity_model.dart';

class FidelityRepository extends ChangeNotifier {
  CustomerLoyalty _clientLoyalty = CustomerLoyalty.fromPoints('demo-client-1', 180, 240);

  final List<CustomerPackage> _clientPackages = [
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
  ];

  CustomerLoyalty get clientLoyalty => _clientLoyalty;
  List<CustomerPackage> get clientPackages => _clientPackages;

  void awardPoints(int points) {
    final newPoints = _clientLoyalty.pointsBalance + points;
    final newTotal = _clientLoyalty.totalPointsEarned + points;
    _clientLoyalty = CustomerLoyalty.fromPoints(_clientLoyalty.customerId, newPoints, newTotal);
    notifyListeners();
  }

  bool redeemPoints(int points) {
    if (_clientLoyalty.pointsBalance < points) return false;
    final newPoints = _clientLoyalty.pointsBalance - points;
    _clientLoyalty = CustomerLoyalty.fromPoints(
      _clientLoyalty.customerId,
      newPoints,
      _clientLoyalty.totalPointsEarned,
    );
    notifyListeners();
    return true;
  }

  bool usePackageSession(String packageId) {
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
      notifyListeners();
      return true;
    }
    return false;
  }
}
