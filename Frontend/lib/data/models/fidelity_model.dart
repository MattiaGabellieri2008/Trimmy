enum LoyaltyTier {
  bronze,
  silver,
  gold,
  diamond,
}

class CustomerLoyalty {
  final String customerId;
  final int pointsBalance;
  final int totalPointsEarned;
  final LoyaltyTier tier;
  final double euroDiscountValue;

  const CustomerLoyalty({
    required this.customerId,
    required this.pointsBalance,
    required this.totalPointsEarned,
    required this.tier,
    required this.euroDiscountValue,
  });

  String get tierLabel {
    switch (tier) {
      case LoyaltyTier.diamond:
        return 'Diamond VIP';
      case LoyaltyTier.gold:
        return 'Gold Client';
      case LoyaltyTier.silver:
        return 'Silver Club';
      case LoyaltyTier.bronze:
      default:
        return 'Bronze Member';
    }
  }

  int get nextThreshold {
    switch (tier) {
      case LoyaltyTier.diamond:
        return 600;
      case LoyaltyTier.gold:
        return 600;
      case LoyaltyTier.silver:
        return 300;
      case LoyaltyTier.bronze:
      default:
        return 100;
    }
  }

  int get progressPercent {
    if (tier == LoyaltyTier.diamond) return 100;
    if (tier == LoyaltyTier.gold) {
      return (((totalPointsEarned - 300) / 300) * 100).clamp(0, 100).round();
    }
    if (tier == LoyaltyTier.silver) {
      return (((totalPointsEarned - 100) / 200) * 100).clamp(0, 100).round();
    }
    return ((totalPointsEarned / 100) * 100).clamp(0, 100).round();
  }

  factory CustomerLoyalty.fromPoints(String customerId, int points, int totalEarned) {
    LoyaltyTier tier = LoyaltyTier.bronze;
    if (totalEarned >= 600) {
      tier = LoyaltyTier.diamond;
    } else if (totalEarned >= 300) {
      tier = LoyaltyTier.gold;
    } else if (totalEarned >= 100) {
      tier = LoyaltyTier.silver;
    }

    return CustomerLoyalty(
      customerId: customerId,
      pointsBalance: points,
      totalPointsEarned: totalEarned,
      tier: tier,
      euroDiscountValue: (points * 0.10),
    );
  }
}

class CustomerPackage {
  final String id;
  final String packageName;
  final String serviceName;
  final int totalSessions;
  final int remainingSessions;
  final DateTime expiryDate;
  final String status;

  const CustomerPackage({
    required this.id,
    required this.packageName,
    required this.serviceName,
    required this.totalSessions,
    required this.remainingSessions,
    required this.expiryDate,
    required this.status,
  });

  bool get isActive => status == 'ACTIVE' && remainingSessions > 0;
}
