import 'package:flutter/foundation.dart';
import '../models/appointment_model.dart';

class AppointmentRepository extends ChangeNotifier {
  final List<Appointment> _appointments = [
    Appointment(
      id: 'appt-1',
      salonId: 'salon-1',
      salonName: 'Atelier Bellezza Duomo',
      salonAddress: 'Piazza del Duomo 12, Milano',
      customerId: 'demo-client-1',
      customerName: 'Mario Rossi',
      customerPhone: '+39 340 1234567',
      serviceId: 'srv-taglio-d',
      serviceName: 'Taglio Sartoriale & Piega Luxury',
      servicePrice: 45.0,
      staffId: 'staff-1',
      staffName: 'Marco (Master Stylist)',
      startTime: DateTime.now().add(const Duration(hours: 3)),
      endTime: DateTime.now().add(const Duration(hours: 3, minutes: 45)),
      status: AppointmentStatus.confirmed,
    ),
    Appointment(
      id: 'appt-2',
      salonId: 'salon-1',
      salonName: 'Atelier Bellezza Duomo',
      salonAddress: 'Piazza del Duomo 12, Milano',
      customerId: 'client-2',
      customerName: 'Giulia Bianchi',
      customerPhone: '+39 333 9988776',
      serviceId: 'srv-balayage',
      serviceName: 'Balayage Sfumato & Gloss',
      servicePrice: 95.0,
      staffId: 'staff-2',
      staffName: 'Elena (Colorist)',
      startTime: DateTime.now().add(const Duration(hours: 5)),
      endTime: DateTime.now().add(const Duration(hours: 6, minutes: 30)),
      status: AppointmentStatus.confirmed,
    ),
    Appointment(
      id: 'appt-3',
      salonId: 'salon-1',
      salonName: 'Atelier Bellezza Duomo',
      salonAddress: 'Piazza del Duomo 12, Milano',
      customerId: 'demo-client-1',
      customerName: 'Mario Rossi',
      customerPhone: '+39 340 1234567',
      serviceId: 'srv-piega',
      serviceName: 'Piega & Styling Glamour',
      servicePrice: 25.0,
      staffId: 'staff-1',
      staffName: 'Marco (Master Stylist)',
      startTime: DateTime.now().subtract(const Duration(days: 14)),
      endTime: DateTime.now().subtract(const Duration(days: 14, minutes: -30)),
      status: AppointmentStatus.completed,
    ),
  ];

  List<Appointment> get allAppointments => _appointments;

  List<Appointment> getClientAppointments(String customerId) {
    return _appointments.where((a) => a.customerId == customerId).toList()
      ..sort((a, b) => b.startTime.compareTo(a.startTime));
  }

  List<Appointment> getSalonAppointments(String salonId, DateTime day) {
    return _appointments.where((a) {
      final isSameSalon = a.salonId == salonId;
      final isSameDay = a.startTime.year == day.year &&
          a.startTime.month == day.month &&
          a.startTime.day == day.day;
      return isSameSalon && isSameDay;
    }).toList()
      ..sort((a, b) => a.startTime.compareTo(b.startTime));
  }

  Future<void> bookAppointment(Appointment appointment) async {
    _appointments.insert(0, appointment);
    notifyListeners();
  }

  Future<void> cancelAppointment(String appointmentId) async {
    final index = _appointments.indexWhere((a) => a.id == appointmentId);
    if (index != -1) {
      final current = _appointments[index];
      _appointments[index] = Appointment(
        id: current.id,
        salonId: current.salonId,
        salonName: current.salonName,
        salonAddress: current.salonAddress,
        customerId: current.customerId,
        customerName: current.customerName,
        customerPhone: current.customerPhone,
        serviceId: current.serviceId,
        serviceName: current.serviceName,
        servicePrice: current.servicePrice,
        staffId: current.staffId,
        staffName: current.staffName,
        startTime: current.startTime,
        endTime: current.endTime,
        status: AppointmentStatus.cancelled,
      );
      notifyListeners();
    }
  }

  Future<void> completeAppointment(String appointmentId) async {
    final index = _appointments.indexWhere((a) => a.id == appointmentId);
    if (index != -1) {
      final current = _appointments[index];
      _appointments[index] = Appointment(
        id: current.id,
        salonId: current.salonId,
        salonName: current.salonName,
        salonAddress: current.salonAddress,
        customerId: current.customerId,
        customerName: current.customerName,
        customerPhone: current.customerPhone,
        serviceId: current.serviceId,
        serviceName: current.serviceName,
        servicePrice: current.servicePrice,
        staffId: current.staffId,
        staffName: current.staffName,
        startTime: current.startTime,
        endTime: current.endTime,
        status: AppointmentStatus.completed,
      );
      notifyListeners();
    }
  }
}
