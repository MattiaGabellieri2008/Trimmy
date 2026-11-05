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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final clientAppts = apptRepo.getClientAppointments(user?.id ?? 'demo-client-1');

    final upcoming = clientAppts.where((a) => a.status == AppointmentStatus.confirmed && a.startTime.isAfter(DateTime.now().subtract(const Duration(hours: 1)))).toList();
    final past = clientAppts.where((a) => a.status != AppointmentStatus.confirmed || a.startTime.isBefore(DateTime.now().subtract(const Duration(hours: 1)))).toList();

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : AppColors.zinc50,
      appBar: AppBar(
        title: const Text('I Miei Appuntamenti', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header Prossima Seduta
          Text(
            'In Programma',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : AppColors.zinc900,
            ),
          ),
          const SizedBox(height: 12),

          if (upcoming.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
              ),
              child: Center(
                child: Text(
                  'Nessun appuntamento in programma.\nEsplora i saloni per prenotare un trattamento!',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: isDark ? Colors.white60 : AppColors.zinc500, fontSize: 13),
                ),
              ),
            )
          else
            ...upcoming.map((appt) => _UpcomingPassCard(appointment: appt, isDark: isDark)),

          const SizedBox(height: 28),

          // Storico Visite
          Text(
            'Storico Visite Passate',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : AppColors.zinc900,
            ),
          ),
          const SizedBox(height: 12),

          if (past.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  'Nessuna visita nello storico.',
                  style: TextStyle(color: isDark ? Colors.white38 : AppColors.zinc400, fontSize: 12),
                ),
              ),
            )
          else
            ...past.map((appt) => _PastAppointmentCard(appointment: appt, isDark: isDark)),
        ],
      ),
    );
  }
}

class _UpcomingPassCard extends StatelessWidget {
  final Appointment appointment;
  final bool isDark;

  const _UpcomingPassCard({required this.appointment, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.3 : 0.04),
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
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2A2A2A) : AppColors.obsidianBlack,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : AppColors.zinc900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  appointment.salonName,
                  style: TextStyle(fontSize: 13, color: isDark ? Colors.white60 : AppColors.zinc500),
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
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : AppColors.zinc800,
                            ),
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
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : AppColors.zinc800,
                            ),
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
                          side: BorderSide(color: isDark ? Colors.red.shade900 : AppColors.zinc200),
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
  final bool isDark;

  const _PastAppointmentCard({required this.appointment, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  appointment.serviceName,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : AppColors.zinc800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${appointment.salonName} • ${DateFormat('d MMM yyyy', 'it_IT').format(appointment.startTime)}',
                  style: TextStyle(fontSize: 11, color: isDark ? Colors.white54 : AppColors.zinc400),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              appointment.status.name.toUpperCase(),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: isDark ? AppColors.gold : AppColors.zinc600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
