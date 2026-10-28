enum AppointmentStatus {
  confirmed,
  completed,
  cancelled,
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
  });

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
    };
  }

  static AppointmentStatus _parseStatus(String? statusStr) {
    switch (statusStr?.toUpperCase()) {
      case 'COMPLETED':
        return AppointmentStatus.completed;
      case 'CANCELLED':
        return AppointmentStatus.cancelled;
      case 'CONFIRMED':
      default:
        return AppointmentStatus.confirmed;
    }
  }
}
