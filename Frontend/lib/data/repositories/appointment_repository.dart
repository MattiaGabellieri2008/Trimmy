import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/appointment_model.dart';

class AppointmentRepository extends ChangeNotifier {
  static const String _storageKey = 'trimmy_local_appointments';
  final List<Appointment> _appointments = [];
  StreamSubscription<QuerySnapshot>? _firestoreSub;

  List<Appointment> get allAppointments => _appointments;

  AppointmentRepository() {
    _loadFromDisk();
    _initFirestoreListener();
  }

  @override
  void dispose() {
    _firestoreSub?.cancel();
    super.dispose();
  }

  void _initFirestoreListener() {
    try {
      _firestoreSub = FirebaseFirestore.instance
          .collection('appointments')
          .snapshots()
          .listen((snapshot) {
        if (snapshot.docs.isNotEmpty) {
          for (final doc in snapshot.docs) {
            final data = doc.data();
            data['id'] = doc.id;
            final appt = Appointment.fromJson(data);
            final index = _appointments.indexWhere((a) => a.id == appt.id);
            if (index != -1) {
              _appointments[index] = appt;
            } else {
              _appointments.add(appt);
            }
          }
          _saveToDisk();
          notifyListeners();
        }
      }, onError: (err) {
        debugPrint('Firestore appointments sync (offline/fallback): $err');
      });
    } catch (e) {
      debugPrint('Firestore non disponibile per appointments: $e');
    }
  }

  Future<void> _loadFromDisk() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw) as List<dynamic>;
        _appointments.clear();
        _appointments.addAll(decoded.map((item) => Appointment.fromJson(item as Map<String, dynamic>)));
        if (_appointments.isNotEmpty) {
          notifyListeners();
          return;
        }
      }
    } catch (e) {
      debugPrint('Nota ripristino appuntamenti disco: $e');
    }

    // Default seed per primo avvio (allineato con la giornata odierna)
    final now = DateTime.now();
    _appointments.addAll([
      Appointment(
        id: 'appt-1',
        salonId: 'salon-1',
        salonName: 'Atelier Bellezza Duomo',
        salonAddress: 'Piazza del Duomo 12, Milano',
        customerId: 'demo-client-1',
        customerName: 'Mario Rossi',
        customerPhone: '+39 340 1234567',
        serviceId: 'srv-taglio-d',
        serviceName: 'Taglio Sartoriale & Piega',
        servicePrice: 45.0,
        staffId: 'staff-1',
        staffName: 'Marco (Master)',
        startTime: DateTime(now.year, now.month, now.day, 10, 0),
        endTime: DateTime(now.year, now.month, now.day, 10, 45),
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
        startTime: DateTime(now.year, now.month, now.day, 11, 30),
        endTime: DateTime(now.year, now.month, now.day, 12, 45),
        status: AppointmentStatus.confirmed,
      ),
      Appointment(
        id: 'appt-block-1',
        salonId: 'salon-1',
        salonName: 'Atelier Bellezza Duomo',
        salonAddress: 'Piazza del Duomo 12, Milano',
        customerId: '',
        customerName: 'Staff Salone',
        customerPhone: '',
        serviceId: 'block-lunch',
        serviceName: 'Pausa Pranzo Team',
        servicePrice: 0.0,
        staffId: 'staff-all',
        staffName: 'Tutti',
        startTime: DateTime(now.year, now.month, now.day, 13, 0),
        endTime: DateTime(now.year, now.month, now.day, 14, 0),
        status: AppointmentStatus.blocked,
        notes: 'Chiusura intermedia per sanificazione e pausa',
      ),
      Appointment(
        id: 'appt-3',
        salonId: 'salon-1',
        salonName: 'Atelier Bellezza Duomo',
        salonAddress: 'Piazza del Duomo 12, Milano',
        customerId: 'client-3',
        customerName: 'Alessandro Volta',
        customerPhone: '+39 347 1122334',
        serviceId: 'srv-barba',
        serviceName: 'Modellatura Barba Luxury',
        servicePrice: 28.0,
        staffId: 'staff-1',
        staffName: 'Marco (Master)',
        startTime: DateTime(now.year, now.month, now.day, 15, 0),
        endTime: DateTime(now.year, now.month, now.day, 15, 30),
        status: AppointmentStatus.confirmed,
      ),
    ]);
    _saveToDisk();
    notifyListeners();
  }

  Future<void> _saveToDisk() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final listJson = jsonEncode(_appointments.map((a) => a.toJson()).toList());
      await prefs.setString(_storageKey, listJson);
    } catch (e) {
      debugPrint('Errore salvataggio appuntamenti su disco: $e');
    }
  }

  List<Appointment> getClientAppointments(String customerId) {
    return _appointments.where((a) => a.customerId == customerId).toList()
      ..sort((a, b) => b.startTime.compareTo(a.startTime));
  }

  List<Appointment> getSalonAppointments(String salonId, DateTime day) {
    return _appointments.where((a) {
      final isSameSalon = a.salonId == salonId || a.salonId.isEmpty || salonId.isEmpty;
      final isSameDay = a.startTime.year == day.year &&
          a.startTime.month == day.month &&
          a.startTime.day == day.day;
      return isSameSalon && isSameDay;
    }).toList()
      ..sort((a, b) => a.startTime.compareTo(b.startTime));
  }

  Future<void> bookAppointment(Appointment appointment) async {
    _appointments.insert(0, appointment);
    await _saveToDisk();
    notifyListeners();

    try {
      await FirebaseFirestore.instance
          .collection('appointments')
          .doc(appointment.id)
          .set(appointment.toJson(), SetOptions(merge: true));
    } catch (e) {
      debugPrint('Firestore async sync bookAppointment: $e');
    }
  }

  Future<void> blockTimeSlot({
    required String salonId,
    required String staffName,
    required String reason,
    required DateTime startTime,
    required DateTime endTime,
    String notes = '',
  }) async {
    final blockAppt = Appointment(
      id: 'block-${DateTime.now().millisecondsSinceEpoch}',
      salonId: salonId,
      salonName: 'Salone',
      salonAddress: '',
      customerId: '',
      customerName: staffName,
      customerPhone: '',
      serviceId: 'block',
      serviceName: reason,
      servicePrice: 0.0,
      staffId: 'staff-block',
      staffName: staffName,
      startTime: startTime,
      endTime: endTime,
      status: AppointmentStatus.blocked,
      notes: notes,
    );
    await bookAppointment(blockAppt);
  }

  Future<void> cancelAppointment(String appointmentId) async {
    final index = _appointments.indexWhere((a) => a.id == appointmentId);
    if (index != -1) {
      _appointments[index] = _appointments[index].copyWith(status: AppointmentStatus.cancelled);
      await _saveToDisk();
      notifyListeners();

      try {
        await FirebaseFirestore.instance
            .collection('appointments')
            .doc(appointmentId)
            .update({'status': 'CANCELLED'});
      } catch (e) {
        debugPrint('Firestore cancel error: $e');
      }
    }
  }

  Future<void> completeAppointment(String appointmentId) async {
    final index = _appointments.indexWhere((a) => a.id == appointmentId);
    if (index != -1) {
      _appointments[index] = _appointments[index].copyWith(status: AppointmentStatus.completed);
      await _saveToDisk();
      notifyListeners();

      try {
        await FirebaseFirestore.instance
            .collection('appointments')
            .doc(appointmentId)
            .update({'status': 'COMPLETED'});
      } catch (e) {
        debugPrint('Firestore complete error: $e');
      }
    }
  }
}
