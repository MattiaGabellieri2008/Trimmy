enum UserRole {
  client,
  salon,
  staff,
}

class AppUser {
  final String id;
  final String email;
  final String displayName;
  final String? phone;
  final UserRole role;
  final String? salonId;
  final String? salonName;
  final String? photoUrl;

  const AppUser({
    required this.id,
    required this.email,
    required this.displayName,
    this.phone,
    required this.role,
    this.salonId,
    this.salonName,
    this.photoUrl,
  });

  bool get isSalonOwner => role == UserRole.salon;
  bool get isClient => role == UserRole.client;
  bool get isStaff => role == UserRole.staff;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as String? ?? json['uid'] as String? ?? '',
      email: json['email'] as String? ?? '',
      displayName: json['displayName'] as String? ?? json['name'] as String? ?? 'Utente Trimmy',
      phone: json['phone'] as String?,
      role: _parseRole(json['role'] as String?),
      salonId: json['salonId'] as String? ?? json['tenantId'] as String?,
      salonName: json['salonName'] as String?,
      photoUrl: json['photoUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'displayName': displayName,
      'phone': phone,
      'role': role.name,
      'salonId': salonId,
      'salonName': salonName,
      'photoUrl': photoUrl,
    };
  }

  static UserRole _parseRole(String? roleStr) {
    switch (roleStr?.toLowerCase()) {
      case 'salon':
      case 'salone':
      case 'titolare':
        return UserRole.salon;
      case 'staff':
      case 'collaboratore':
        return UserRole.staff;
      case 'client':
      case 'cliente':
      default:
        return UserRole.client;
    }
  }
}
