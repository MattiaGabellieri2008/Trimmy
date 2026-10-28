import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/appointment_model.dart';
import '../../data/repositories/appointment_repository.dart';
import '../../data/repositories/auth_repository.dart';

class AppointmentsScreen extends StatelessWidget {
  const AppointmentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthRepository>().currentUser;
    final apptRepo = context.watch<AppointmentRepository>();
    final clientAppts = apptRepo.getClientAppointments(user?.id ?? 'demo-client-1');

    final upcoming = clientAppts.where((a) => a.status == AppointmentStatus.confirmed && a.startTime.isAfter(DateTime.now().subtract(const Duration(hours: 1)))).toList();
    final past = clientAppts.where((a) => a.status != AppointmentStatus.confirmed || a.startTime.isBefore(DateTime.now().subtract(const Duration(hours: 1)))).toList();

    return Scaffold(
      backgroundColor: AppColors.zinc50,
      appBar: AppBar(
        title: const Text('I Miei Appuntamenti', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header Prossima Seduta
          const Text(
            'In Programma',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.zinc900),
          ),
          const SizedBox(height: 12),

          if (upcoming.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.zinc200),
              ),
              child: const Center(
                child: Text(
                  'Nessun appuntamento in programma.\nEsplora i saloni per prenotare un trattamento!',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.zinc500, fontSize: 13),
                ),
              ),
            )
          else
            ...upcoming.map((appt) => _UpcomingPassCard(appointment: appt)),

          const SizedBox(height: 28),

          // Storico Visite
          const Text(
            'Storico Visite Passate',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.zinc900),
          ),
          const SizedBox(height: 12),

          if (past.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'Nessuna visita nello storico.',
                  style: TextStyle(color: AppColors.zinc400, fontSize: 12),
                ),
              ),
            )
          else
            ...past.map((appt) => _PastAppointmentCard(appointment: appt)),
        ],
      ),
    );
  }
}

class _UpcomingPassCard extends StatelessWidget {
  final Appointment appointment;

  const _UpcomingPassCard({required this.appointment});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.zinc200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header Scuro Boarding Pass
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: const BoxDecoration(
              color: AppColors.obsidianBlack,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.between,
              children: [
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: AppColors.emerald,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'CONFERMATO',
                      style: TextStyle(
                        color: AppColors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
                Text(
                  '€${appointment.servicePrice.toStringAsFixed(0)}',
                  style: const TextStyle(
                    color: AppColors.goldLight,
                    fontWeight: FontWeight.w900,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),

          // Dettagli Appuntamento
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  appointment.serviceName,
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.zinc900),
                ),
                const SizedBox(height: 4),
                Text(
                  appointment.salonName,
                  style: const TextStyle(fontSize: 13, color: AppColors.zinc500),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('DATA & ORA', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.zinc400)),
                          const SizedBox(height: 2),
                          Text(
                            DateFormat('EEE d MMM, HH:mm', 'it_IT').format(appointment.startTime),
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.zinc800),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('STYLIST', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.zinc400)),
                          const SizedBox(height: 2),
                          Text(
                            appointment.staffName,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.zinc800),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          context.read<AppointmentRepository>().cancelAppointment(appointment.id);
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.rose,
                          side: const BorderSide(color: AppColors.zinc200),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Disdici', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PastAppointmentCard extends StatelessWidget {
  final Appointment appointment;

  const _PastAppointmentCard({required this.appointment});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.zinc200),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.between,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  appointment.serviceName,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.zinc800),
                ),
                const SizedBox(height: 2),
                Text(
                  '${appointment.salonName} • ${DateFormat('d MMM yyyy', 'it_IT').format(appointment.startTime)}',
                  style: const TextStyle(fontSize: 11, color: AppColors.zinc400),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.zinc100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              appointment.status.name.toUpperCase(),
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.zinc600),
            ),
          ),
        ],
      ),
    );
  }
}
