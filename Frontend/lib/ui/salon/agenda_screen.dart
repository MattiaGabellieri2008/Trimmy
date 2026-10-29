import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/appointment_model.dart';
import '../../data/repositories/appointment_repository.dart';

class SalonAgendaScreen extends StatefulWidget {
  const SalonAgendaScreen({super.key});

  @override
  State<SalonAgendaScreen> createState() => _SalonAgendaScreenState();
}

class _SalonAgendaScreenState extends State<SalonAgendaScreen> {
  DateTime _selectedDay = DateTime.now();
  String _selectedStaff = 'Tutti';

  final List<String> _staffFilters = ['Tutti', 'Marco', 'Elena', 'Luca'];

  @override
  Widget build(BuildContext context) {
    final apptRepo = context.watch<AppointmentRepository>();
    final appts = apptRepo.getSalonAppointments('salon-1', _selectedDay).where((a) {
      if (_selectedStaff == 'Tutti') return true;
      return a.staffName.contains(_selectedStaff);
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.zinc50,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.obsidianBlack,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.calendar_month, color: AppColors.white, size: 16),
            ),
            const SizedBox(width: 8),
            const Text(
              'Agenda Salone',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.emeraldLight,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.emerald.withOpacity(0.3)),
              ),
              child: const Text(
                'LIVE SYNC',
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.emerald),
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // 1. Striscia Bolle Giorni
          Container(
            color: AppColors.white,
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: SizedBox(
              height: 64,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: 14,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final day = DateTime.now().add(Duration(days: index - 2));
                  final isSelected = day.day == _selectedDay.day && day.month == _selectedDay.month;

                  return GestureDetector(
                    onTap: () => setState(() => _selectedDay = day),
                    child: Container(
                      width: 52,
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.obsidianBlack : AppColors.zinc50,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: isSelected ? AppColors.obsidianBlack : AppColors.zinc200,
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            DateFormat('E', 'it_IT').format(day).toUpperCase(),
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: isSelected ? AppColors.zinc400 : AppColors.zinc500,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${day.day}',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              color: isSelected ? AppColors.white : AppColors.zinc900,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ),

          // 2. Filtro Operatori
          Container(
            color: AppColors.white,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: SizedBox(
              height: 32,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _staffFilters.length,
                separatorBuilder: (_, __) => const SizedBox(width: 6),
                itemBuilder: (context, index) {
                  final staff = _staffFilters[index];
                  final isSelected = _selectedStaff == staff;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedStaff = staff),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.zinc900 : AppColors.zinc100,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Center(
                        child: Text(
                          staff,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                            color: isSelected ? AppColors.white : AppColors.zinc700,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),

          const Divider(height: 1, color: AppColors.zinc200),

          // 3. Timeline / Lista Appuntamenti del Giorno
          Expanded(
            child: appts.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.event_available, size: 48, color: AppColors.zinc300),
                        const SizedBox(height: 8),
                        Text(
                          'Nessun appuntamento per ${DateFormat('d MMMM', 'it_IT').format(_selectedDay)}',
                          style: const TextStyle(fontSize: 13, color: AppColors.zinc500),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: appts.length,
                    itemBuilder: (context, index) {
                      final appt = appts[index];
                      return _SalonApptCard(
                        appointment: appt,
                        onComplete: () {
                          context.read<AppointmentRepository>().completeAppointment(appt.id);
                        },
                        onCancel: () {
                          context.read<AppointmentRepository>().cancelAppointment(appt.id);
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _SalonApptCard extends StatelessWidget {
  final Appointment appointment;
  final VoidCallback onComplete;
  final VoidCallback onCancel;

  const _SalonApptCard({
    required this.appointment,
    required this.onComplete,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    final isCompleted = appointment.status == AppointmentStatus.completed;
    final isCancelled = appointment.status == AppointmentStatus.cancelled;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isCompleted
              ? AppColors.emerald.withOpacity(0.3)
              : isCancelled
                  ? AppColors.rose.withOpacity(0.3)
                  : AppColors.zinc200,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${DateFormat('HH:mm').format(appointment.startTime)} - ${DateFormat('HH:mm').format(appointment.endTime)}',
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 15,
                  color: AppColors.zinc900,
                ),
              ),
              _statusBadge(appointment.status),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            appointment.customerName,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.zinc900),
          ),
          Text(
            '${appointment.serviceName} • €${appointment.servicePrice.toStringAsFixed(0)}',
            style: const TextStyle(fontSize: 12, color: AppColors.zinc600),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.badge_outlined, size: 12, color: AppColors.zinc400),
              const SizedBox(width: 4),
              Text(
                appointment.staffName,
                style: const TextStyle(fontSize: 11, color: AppColors.zinc400, fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              Text(
                appointment.customerPhone,
                style: const TextStyle(fontSize: 11, color: AppColors.zinc500),
              ),
            ],
          ),

          if (!isCompleted && !isCancelled) ...[
            const Divider(height: 20, color: AppColors.zinc100),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: onCancel,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.rose,
                      side: const BorderSide(color: AppColors.zinc200),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    child: const Text('Annulla', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton(
                    onPressed: onComplete,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.emerald,
                      foregroundColor: AppColors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    child: const Text('Completa', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _statusBadge(AppointmentStatus status) {
    Color bg = AppColors.zinc100;
    Color fg = AppColors.zinc700;
    String text = 'CONFERMATO';

    if (status == AppointmentStatus.completed) {
      bg = AppColors.emeraldLight;
      fg = AppColors.emerald;
      text = 'COMPLETATO';
    } else if (status == AppointmentStatus.cancelled) {
      bg = AppColors.roseLight;
      fg = AppColors.rose;
      text = 'ANNULLATO';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Text(
        text,
        style: TextStyle(color: fg, fontWeight: FontWeight.w900, fontSize: 9, letterSpacing: 0.5),
      ),
    );
  }
}
