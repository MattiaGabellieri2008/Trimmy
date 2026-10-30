enum AppointmentStatus {
  confirmed,
  completed,
  cancelled,
  blocked,
}

class Appointment {
  final String id;
  final String salonId;
  final String salonName;
  final String salonAddress;
  final String customerId;
  final String customerName;
  final String customerPhone;
  final String serviceId;
  final String serviceName;
  final double servicePrice;
  final String staffId;
  final String staffName;
  final DateTime startTime;
  final DateTime endTime;
  final AppointmentStatus status;
  final String notes;

  const Appointment({
    required this.id,
    required this.salonId,
    required this.salonName,
    required this.salonAddress,
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    required this.serviceId,
    required this.serviceName,
    required this.servicePrice,
    required this.staffId,
    required this.staffName,
    required this.startTime,
    required this.endTime,
    required this.status,
    this.notes = '',
  });

  Appointment copyWith({
    String? id,
    String? salonId,
    String? salonName,
    String? salonAddress,
    String? customerId,
    String? customerName,
    String? customerPhone,
    String? serviceId,
    String? serviceName,
    double? servicePrice,
    String? staffId,
    String? staffName,
    DateTime? startTime,
    DateTime? endTime,
    AppointmentStatus? status,
    String? notes,
  }) {
    return Appointment(
      id: id ?? this.id,
      salonId: salonId ?? this.salonId,
      salonName: salonName ?? this.salonName,
      salonAddress: salonAddress ?? this.salonAddress,
      customerId: customerId ?? this.customerId,
      customerName: customerName ?? this.customerName,
      customerPhone: customerPhone ?? this.customerPhone,
      serviceId: serviceId ?? this.serviceId,
      serviceName: serviceName ?? this.serviceName,
      servicePrice: servicePrice ?? this.servicePrice,
      staffId: staffId ?? this.staffId,
      staffName: staffName ?? this.staffName,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      status: status ?? this.status,
      notes: notes ?? this.notes,
    );
  }

  factory Appointment.fromJson(Map<String, dynamic> json) {
    return Appointment(
      id: json['id'] as String? ?? '',
      salonId: json['salonId'] as String? ?? '',
      salonName: json['salonName'] as String? ?? 'Salone',
      salonAddress: json['salonAddress'] as String? ?? '',
      customerId: json['customerId'] as String? ?? '',
      customerName: json['customerName'] as String? ?? 'Cliente',
      customerPhone: json['customerPhone'] as String? ?? '',
      serviceId: json['serviceId'] as String? ?? '',
      serviceName: json['serviceName'] as String? ?? 'Taglio & Piega',
      servicePrice: (json['servicePrice'] as num?)?.toDouble() ?? 30.0,
      staffId: json['staffId'] as String? ?? '',
      staffName: json['staffName'] as String? ?? 'Stylist',
      startTime: json['startTime'] != null 
          ? DateTime.tryParse(json['startTime'].toString()) ?? DateTime.now()
          : DateTime.now(),
      endTime: json['endTime'] != null 
          ? DateTime.tryParse(json['endTime'].toString()) ?? DateTime.now().add(const Duration(minutes: 45))
          : DateTime.now().add(const Duration(minutes: 45)),
      status: _parseStatus(json['status'] as String?),
      notes: json['notes'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'salonId': salonId,
      'salonName': salonName,
      'salonAddress': salonAddress,
      'customerId': customerId,
      'customerName': customerName,
      'customerPhone': customerPhone,
      'serviceId': serviceId,
      'serviceName': serviceName,
      'servicePrice': servicePrice,
      'staffId': staffId,
      'staffName': staffName,
      'startTime': startTime.toIso8601String(),
      'endTime': endTime.toIso8601String(),
      'status': status.name.toUpperCase(),
      'notes': notes,
    };
  }

  static AppointmentStatus _parseStatus(String? statusStr) {
    switch (statusStr?.toUpperCase()) {
      case 'COMPLETED':
        return AppointmentStatus.completed;
      case 'CANCELLED':
        return AppointmentStatus.cancelled;
      case 'BLOCKED':
        return AppointmentStatus.blocked;
      case 'CONFIRMED':
      default:
        return AppointmentStatus.confirmed;
    }
  }
}
