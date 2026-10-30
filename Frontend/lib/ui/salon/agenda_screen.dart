import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/appointment_model.dart';
import '../../data/models/service_model.dart';
import '../../data/repositories/appointment_repository.dart';
import '../../data/repositories/auth_repository.dart';
import '../../data/repositories/salon_repository.dart';
import 'daily_cash_closing_modal.dart';
import 'pos_checkout_screen.dart';

class SalonAgendaScreen extends StatefulWidget {
  const SalonAgendaScreen({super.key});

  @override
  State<SalonAgendaScreen> createState() => _SalonAgendaScreenState();
}

class _SalonAgendaScreenState extends State<SalonAgendaScreen> {
  DateTime _selectedDate = DateTime.now();
  String _viewMode = 'Giorno'; // 'Giorno', 'Settimana', 'Mese', 'Staff'
  String _selectedStaff = 'Tutti';
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  static const List<String> _timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00',
  ];

  static const List<String> _staffList = ['Tutti', 'Marco', 'Elena', 'Luca'];

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  bool _isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month && date.day == now.day;
  }

  void _changeDay(int deltaDays) {
    setState(() {
      _selectedDate = _selectedDate.add(Duration(days: deltaDays));
    });
  }

  void _goToToday() {
    setState(() {
      _selectedDate = DateTime.now();
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2025, 1, 1),
      lastDate: DateTime(2030, 12, 31),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.obsidianBlack,
              onPrimary: AppColors.white,
              onSurface: AppColors.zinc900,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  List<DateTime> _getCurrentWeekDays(DateTime baseDate) {
    // Calcola il lunedì della settimana
    final weekday = baseDate.weekday; // 1 = lunedì, 7 = domenica
    final monday = baseDate.subtract(Duration(days: weekday - 1));
    return List.generate(7, (i) => monday.add(Duration(days: i)));
  }

  @override
  Widget build(BuildContext context) {
    final apptRepo = context.watch<AppointmentRepository>();
    final authRepo = context.watch<AuthRepository>();
    final salonId = authRepo.currentUser?.salonId ?? 'salon-1';
    final salonName = authRepo.currentUser?.salonName ?? 'Atelier Bellezza Duomo';

    final allDayAppts = apptRepo.getSalonAppointments(salonId, _selectedDate);

    // Filtra per staff e per eventuale ricerca
    final filteredAppts = allDayAppts.where((a) {
      final matchesStaff = _selectedStaff == 'Tutti' || a.staffName.contains(_selectedStaff);
      final matchesSearch = _searchQuery.isEmpty ||
          a.customerName.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          a.serviceName.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          a.customerPhone.contains(_searchQuery);
      return matchesStaff && matchesSearch;
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        child: Column(
          children: [
            // 1. TOP BAR REALE CON LOGO, RICERCA E NOTIFICHE
            _buildTopHeader(),

            // 2. CORPO SCROLLABILE CON CONTROLLI, AZIONI E GRIGLIA
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  // Intestazione data estesa
                  _buildDateBanner(filteredAppts.length),

                  // Barra controlli (< Oggi >, Calendario, Modalità Vista)
                  _buildControlsRow(),

                  const SizedBox(height: 10),

                  // Barra azioni rapide (+ Prenota, Ferie, Banco, Z)
                  _buildActionButtonsRow(salonName),

                  const SizedBox(height: 14),

                  // Striscia settimanale con bolle giorno e frecce < >
                  _buildWeekBubbleStrip(apptRepo, salonId),

                  const SizedBox(height: 12),

                  // Filtro operatore (se vista staff o per affinare)
                  if (_viewMode == 'Staff') _buildStaffFilterRow(),

                  // Griglia Oraria Lavoro (ORA | Orario di Lavoro)
                  _buildTimelineGrid(filteredAppts, salonId, salonName),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── 1. TOP BAR ────────────────────────────────────────────────────────────
  Widget _buildTopHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(bottom: BorderSide(color: AppColors.zinc200, width: 1)),
      ),
      child: Row(
        children: [
          // Logo Trimmy
          const Text(
            'Trimmy.',
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 19,
              letterSpacing: -0.5,
              color: AppColors.zinc900,
            ),
          ),
          const SizedBox(width: 12),

          // Barra di ricerca espansa
          Expanded(
            child: Container(
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.zinc100,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.zinc200),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Row(
                children: [
                  const Icon(Icons.search, size: 18, color: AppColors.zinc500),
                  const SizedBox(width: 6),
                  Expanded(
                    child: TextField(
                      controller: _searchCtrl,
                      onChanged: (val) => setState(() => _searchQuery = val.trim()),
                      style: const TextStyle(fontSize: 12, color: AppColors.zinc900),
                      decoration: const InputDecoration(
                        hintText: 'Cerca clienti, trattamenti...',
                        hintStyle: TextStyle(fontSize: 12, color: AppColors.zinc400),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                  if (_searchQuery.isNotEmpty)
                    GestureDetector(
                      onTap: () {
                        _searchCtrl.clear();
                        setState(() => _searchQuery = '');
                      },
                      child: const Icon(Icons.close, size: 16, color: AppColors.zinc400),
                    ),
                ],
              ),
            ),
          ),

          const SizedBox(width: 10),

          // Campanella notifiche con badge
          GestureDetector(
            onTap: _showNotificationsSheet,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.zinc50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.zinc200),
                  ),
                  child: const Icon(Icons.notifications_none, size: 20, color: AppColors.zinc700),
                ),
                Positioned(
                  top: -2,
                  right: -2,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppColors.gold,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── 2. DATA HEADER ────────────────────────────────────────────────────────
  Widget _buildDateBanner(int apptCount) {
    final dateStr = DateFormat('EEEE d MMMM yyyy', 'it_IT').format(_selectedDate);
    // Capitalize first letter
    final capitalized = dateStr.isNotEmpty ? '${dateStr[0].toUpperCase()}${dateStr.substring(1)}' : dateStr;
    final isToday = _isToday(_selectedDate);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                capitalized,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: AppColors.zinc900,
                  letterSpacing: -0.3,
                ),
              ),
              if (isToday) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.obsidianBlack,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Oggi',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 2),
          Text(
            '$apptCount appuntament${apptCount == 1 ? 'o trovato' : 'i trovati'}.',
            style: const TextStyle(fontSize: 12, color: AppColors.zinc500),
          ),
        ],
      ),
    );
  }

  // ─── 3. BARRA CONTROLLI (< Oggi >, 📅, Viste) ──────────────────────────────
  Widget _buildControlsRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          // Navigazione giorno: < Oggi >
          Container(
            height: 34,
            decoration: BoxDecoration(
              color: AppColors.zinc100,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.zinc200),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left, size: 18, color: AppColors.zinc700),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 30),
                  onPressed: () => _changeDay(-1),
                ),
                GestureDetector(
                  onTap: _goToToday,
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 4),
                    child: Text(
                      'Oggi',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.zinc900),
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right, size: 18, color: AppColors.zinc700),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 30),
                  onPressed: () => _changeDay(1),
                ),
              ],
            ),
          ),

          const SizedBox(width: 8),

          // Tasto Calendario
          Container(
            height: 34,
            width: 36,
            decoration: BoxDecoration(
              color: AppColors.zinc100,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.zinc200),
            ),
            child: IconButton(
              icon: const Icon(Icons.calendar_today_outlined, size: 16, color: AppColors.zinc700),
              padding: EdgeInsets.zero,
              onPressed: _pickDate,
            ),
          ),

          const SizedBox(width: 8),

          // Selettore Viste: Giorno, Settimana, Mese, Staff
          Expanded(
            child: Container(
              height: 34,
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                color: AppColors.zinc100,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.zinc200),
              ),
              child: Row(
                children: ['Giorno', 'Settimana', 'Mese', 'Staff'].map((mode) {
                  final isSelected = _viewMode == mode;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _viewMode = mode),
                      child: Container(
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: isSelected
                              ? [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.06),
                                    blurRadius: 2,
                                    offset: const Offset(0, 1),
                                  ),
                                ]
                              : null,
                        ),
                        child: Center(
                          child: Text(
                            mode,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                              color: isSelected ? AppColors.zinc900 : AppColors.zinc500,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── 4. AZIONI RAPIDE (+ Prenota, Ferie, Banco, Z) ─────────────────────────
  Widget _buildActionButtonsRow(String salonName) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          // + Prenota (Nero Obsidian)
          ElevatedButton.icon(
            onPressed: () => _showNewAppointmentSheet(context, salonName),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.obsidianBlack,
              foregroundColor: AppColors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              elevation: 0,
            ),
            icon: const Icon(Icons.add, size: 16),
            label: const Text('Prenota', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          ),

          const SizedBox(width: 8),

          // Ferie / Pausa (Ambra Chiaro)
          OutlinedButton.icon(
            onPressed: () => _showBlockTimeSheet(context, salonName),
            style: OutlinedButton.styleFrom(
              backgroundColor: const Color(0xFFFFFBEB),
              foregroundColor: const Color(0xFF78350F), // amber-900
              side: const BorderSide(color: Color(0xFFFCD34D)), // amber-300
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            icon: const Icon(Icons.coffee, size: 16, color: Color(0xFFB45309)),
            label: const Text('Ferie', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          ),

          const SizedBox(width: 8),

          // Cassa Banco (Arancione Gradiente)
          ElevatedButton.icon(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const PosCheckoutScreen()),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFF59E0B),
              foregroundColor: AppColors.zinc900,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              elevation: 0,
            ),
            icon: const Icon(Icons.point_of_sale, size: 16, color: AppColors.zinc900),
            label: const Text('Banco', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          ),

          const SizedBox(width: 8),

          // Chiusura Z (Zinc Fiscale)
          OutlinedButton.icon(
            onPressed: () {
              DailyCashClosingModal.show(
                context,
                salonName: salonName,
                date: _selectedDate,
              );
            },
            style: OutlinedButton.styleFrom(
              backgroundColor: AppColors.zinc100,
              foregroundColor: AppColors.zinc800,
              side: const BorderSide(color: AppColors.zinc300),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            icon: const Icon(Icons.lock_outline, size: 15, color: Color(0xFFD97706)),
            label: const Text('Z', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          ),
        ],
      ),
    );
  }

  // ─── 5. STRISCIA SETTIMANALE A BOLLE CON FRECCE < > ─────────────────────────
  Widget _buildWeekBubbleStrip(AppointmentRepository apptRepo, String salonId) {
    final weekDays = _getCurrentWeekDays(_selectedDate);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.zinc200),
      ),
      child: Row(
        children: [
          // Freccia indietro di una settimana
          IconButton(
            icon: const Icon(Icons.chevron_left, size: 20, color: AppColors.zinc500),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 24),
            onPressed: () => _changeDay(-7),
          ),

          // 7 Bolle Giorno
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: weekDays.map((d) {
                final isSelected = d.year == _selectedDate.year &&
                    d.month == _selectedDate.month &&
                    d.day == _selectedDate.day;
                final isToday = _isToday(d);
                final dayName = DateFormat('E', 'it_IT').format(d).toUpperCase().replaceAll('.', '');
                final dayAppts = apptRepo.getSalonAppointments(salonId, d);

                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedDate = d),
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.obsidianBlack : AppColors.zinc50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? AppColors.obsidianBlack : AppColors.zinc200,
                          width: 1,
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            dayName,
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: isSelected ? AppColors.zinc400 : AppColors.zinc500,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${d.day}',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              color: isSelected ? AppColors.white : AppColors.zinc900,
                            ),
                          ),
                          const SizedBox(height: 3),
                          // Badge oggi o pallino appuntamenti
                          if (isToday)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                              decoration: BoxDecoration(
                                color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFFFEF3C7),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                'OGGI',
                                style: TextStyle(
                                  fontSize: 7,
                                  fontWeight: FontWeight.bold,
                                  color: isSelected ? AppColors.obsidianBlack : const Color(0xFF92400E),
                                ),
                              ),
                            )
                          else if (dayAppts.isNotEmpty)
                            Container(
                              width: 5,
                              height: 5,
                              decoration: BoxDecoration(
                                color: isSelected ? const Color(0xFFF59E0B) : AppColors.zinc900,
                                shape: BoxShape.circle,
                              ),
                            )
                          else
                            const SizedBox(height: 9),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          // Freccia avanti di una settimana
          IconButton(
            icon: const Icon(Icons.chevron_right, size: 20, color: AppColors.zinc500),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 24),
            onPressed: () => _changeDay(7),
          ),
        ],
      ),
    );
  }

  // ─── 6. FILTRO STAFF ───────────────────────────────────────────────────────
  Widget _buildStaffFilterRow() {
    return Container(
      height: 34,
      margin: const EdgeInsets.only(bottom: 12),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _staffList.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (context, i) {
          final staff = _staffList[i];
          final isSelected = _selectedStaff == staff;
          return GestureDetector(
            onTap: () => setState(() => _selectedStaff = staff),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.obsidianBlack : AppColors.zinc100,
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
    );
  }

  // ─── 7. TABELLA ORARIA / TIMELINE GRID ─────────────────────────────────────
  Widget _buildTimelineGrid(List<Appointment> dayAppts, String salonId, String salonName) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.zinc200),
      ),
      child: Column(
        children: [
          // Riga Intestazione: ORA | Orario di Lavoro
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: const BoxDecoration(
              color: Color(0xFFF8FAFC),
              borderRadius: BorderRadius.vertical(top: Radius.circular(15)),
              border: Border(bottom: BorderSide(color: AppColors.zinc200)),
            ),
            child: const Row(
              children: [
                SizedBox(
                  width: 50,
                  child: Text(
                    'ORA',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.zinc500),
                  ),
                ),
                Text(
                  'Orario di Lavoro',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.zinc600),
                ),
              ],
            ),
          ),

          // Slot Orari
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _timeSlots.length,
            separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
            itemBuilder: (context, index) {
              final slotTime = _timeSlots[index];
              final slotHour = int.parse(slotTime.split(':')[0]);

              // Appuntamenti che cadono in questa ora
              final slotAppts = dayAppts.where((a) => a.startTime.hour == slotHour).toList();

              return Container(
                constraints: const BoxConstraints(minHeight: 64),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Colonna Ora
                    Container(
                      width: 58,
                      padding: const EdgeInsets.only(top: 10, left: 12),
                      child: Text(
                        slotTime,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.zinc400,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),

                    // Colonna Appuntamenti / Slot Libero
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(4, 6, 8, 6),
                        child: slotAppts.isEmpty
                            ? _buildEmptySlot(slotTime, salonName)
                            : Column(
                                children: slotAppts.map((appt) => _buildAppointmentCard(appt)).toList(),
                              ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  // Slot libero cliccabile
  Widget _buildEmptySlot(String slotTime, String salonName) {
    return InkWell(
      onTap: () {
        _showNewAppointmentSheet(context, salonName, initialTime: slotTime);
      },
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Row(
            children: [
              const SizedBox(width: 8),
              Icon(Icons.add_circle_outline, size: 14, color: AppColors.zinc300),
              const SizedBox(width: 6),
              Text(
                'Disponibile • Tocca per prenotare',
                style: TextStyle(fontSize: 11, color: AppColors.zinc400, fontStyle: FontStyle.italic),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Carta appuntamento / blocco
  Widget _buildAppointmentCard(Appointment appt) {
    final isBlocked = appt.status == AppointmentStatus.blocked;
    final isCompleted = appt.status == AppointmentStatus.completed;
    final isCancelled = appt.status == AppointmentStatus.cancelled;

    Color cardBg = AppColors.white;
    Color borderCol = AppColors.zinc200;
    Color badgeBg = AppColors.emeraldLight;
    Color badgeFg = AppColors.emerald;
    String badgeText = 'CONFERMATO';

    if (isBlocked) {
      cardBg = const Color(0xFFFFFBEB); // amber-50
      borderCol = const Color(0xFFFDE68A); // amber-200
      badgeBg = const Color(0xFFFEF3C7);
      badgeFg = const Color(0xFFB45309);
      badgeText = 'PAUSA / FERIE';
    } else if (isCompleted) {
      cardBg = const Color(0xFFF0FDF4); // emerald-50
      borderCol = const Color(0xFFBBF7D0);
      badgeBg = AppColors.emeraldLight;
      badgeFg = AppColors.emerald;
      badgeText = 'COMPLETATO';
    } else if (isCancelled) {
      cardBg = const Color(0xFFFFF1F2); // rose-50
      borderCol = const Color(0xFFFECDD3);
      badgeBg = AppColors.roseLight;
      badgeFg = AppColors.rose;
      badgeText = 'ANNULLATO';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderCol),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 2,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Orario e Badge Stato
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    isBlocked ? Icons.coffee : Icons.access_time,
                    size: 13,
                    color: isBlocked ? const Color(0xFFB45309) : AppColors.zinc600,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${DateFormat('HH:mm').format(appt.startTime)} - ${DateFormat('HH:mm').format(appt.endTime)}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.zinc900),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(6)),
                child: Text(
                  badgeText,
                  style: TextStyle(color: badgeFg, fontWeight: FontWeight.w900, fontSize: 8),
                ),
              ),
            ],
          ),

          const SizedBox(height: 6),

          // Nome cliente e servizio
          Text(
            isBlocked ? appt.serviceName : appt.customerName,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.zinc900),
          ),
          if (!isBlocked) ...[
            Text(
              '${appt.serviceName} • € ${appt.servicePrice.toStringAsFixed(0)}',
              style: const TextStyle(fontSize: 11, color: AppColors.zinc600),
            ),
          ],

          const SizedBox(height: 4),

          // Operatore & Telefono
          Row(
            children: [
              const Icon(Icons.badge_outlined, size: 12, color: AppColors.zinc400),
              const SizedBox(width: 4),
              Text(
                appt.staffName,
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.zinc500),
              ),
              if (appt.customerPhone.isNotEmpty) ...[
                const Spacer(),
                const Icon(Icons.phone_outlined, size: 11, color: AppColors.zinc400),
                const SizedBox(width: 3),
                Text(
                  appt.customerPhone,
                  style: const TextStyle(fontSize: 10, color: AppColors.zinc500),
                ),
              ],
            ],
          ),

          // Azioni Rapide (Completa, Incassa POS, Annulla)
          if (!isBlocked && !isCompleted && !isCancelled) ...[
            const Divider(height: 14, color: Color(0xFFE2E8F0)),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                // Annulla
                GestureDetector(
                  onTap: () {
                    context.read<AppointmentRepository>().cancelAppointment(appt.id);
                  },
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    child: Text(
                      'Annulla',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.rose),
                    ),
                  ),
                ),

                const SizedBox(width: 6),

                // Incassa con Cassa POS
                GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const PosCheckoutScreen()),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFFFCD34D)),
                    ),
                    child: const Text(
                      'Incassa POS',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF92400E)),
                    ),
                  ),
                ),

                const SizedBox(width: 6),

                // Completa
                GestureDetector(
                  onTap: () {
                    context.read<AppointmentRepository>().completeAppointment(appt.id);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.emerald,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'Completa',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.white),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  // ─── MODALE NUOVO APPUNTAMENTO ─────────────────────────────────────────────
  void _showNewAppointmentSheet(BuildContext context, String salonName, {String initialTime = '10:00'}) {
    final formNameCtrl = TextEditingController();
    final formPhoneCtrl = TextEditingController(text: '+39 ');
    final formNotesCtrl = TextEditingController();

    String selectedStaff = 'Marco (Master)';
    String selectedTime = initialTime;
    SalonService? selectedService;

    final services = Provider.of<SalonRepository>(context, listen: false).services;
    if (services.isNotEmpty) {
      selectedService = services.first;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          return Container(
            decoration: const BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            padding: EdgeInsets.only(
              top: 16,
              left: 20,
              right: 20,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 36,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.zinc300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Nuovo Appuntamento',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: AppColors.zinc900),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(ctx),
                        icon: const Icon(Icons.close, color: AppColors.zinc400),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Cliente
                  TextField(
                    controller: formNameCtrl,
                    decoration: InputDecoration(
                      labelText: 'Nome e Cognome Cliente',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: formPhoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      labelText: 'Numero di Telefono',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Servizio
                  DropdownButtonFormField<SalonService>(
                    value: selectedService,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: 'Trattamento / Servizio',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                    items: services.map((s) {
                      return DropdownMenuItem(
                        value: s,
                        child: Text(
                          '${s.name} (€${s.price.toStringAsFixed(0)} • ${s.durationMinutes}m)',
                          overflow: TextOverflow.ellipsis,
                        ),
                      );
                    }).toList(),
                    onChanged: (val) => setModalState(() => selectedService = val),
                  ),

                  const SizedBox(height: 12),

                  // Staff e Orario
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: selectedStaff,
                          decoration: InputDecoration(
                            labelText: 'Operatore',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                          items: const [
                            DropdownMenuItem(value: 'Marco (Master)', child: Text('Marco')),
                            DropdownMenuItem(value: 'Elena (Colorist)', child: Text('Elena')),
                            DropdownMenuItem(value: 'Luca (Barber)', child: Text('Luca')),
                          ],
                          onChanged: (val) => setModalState(() => selectedStaff = val ?? selectedStaff),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: selectedTime,
                          decoration: InputDecoration(
                            labelText: 'Orario Inizio',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                          items: _timeSlots.map((t) {
                            return DropdownMenuItem(value: t, child: Text(t));
                          }).toList(),
                          onChanged: (val) => setModalState(() => selectedTime = val ?? selectedTime),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),

                  TextField(
                    controller: formNotesCtrl,
                    decoration: InputDecoration(
                      labelText: 'Note Tecniche o Preferenze (opzionale)',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),

                  const SizedBox(height: 20),

                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () {
                        final name = formNameCtrl.text.trim();
                        if (name.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Inserisci il nome del cliente')),
                          );
                          return;
                        }

                        final hour = int.parse(selectedTime.split(':')[0]);
                        final start = DateTime(
                          _selectedDate.year,
                          _selectedDate.month,
                          _selectedDate.day,
                          hour,
                          0,
                        );
                        final duration = selectedService?.durationMinutes ?? 45;
                        final end = start.add(Duration(minutes: duration));

                        final newAppt = Appointment(
                          id: 'appt-${DateTime.now().millisecondsSinceEpoch}',
                          salonId: 'salon-1',
                          salonName: salonName,
                          salonAddress: '',
                          customerId: 'cust-${DateTime.now().millisecondsSinceEpoch}',
                          customerName: name,
                          customerPhone: formPhoneCtrl.text.trim(),
                          serviceId: selectedService?.id ?? 'srv-taglio',
                          serviceName: selectedService?.name ?? 'Taglio & Piega',
                          servicePrice: selectedService?.price ?? 35.0,
                          staffId: 'staff-1',
                          staffName: selectedStaff,
                          startTime: start,
                          endTime: end,
                          status: AppointmentStatus.confirmed,
                          notes: formNotesCtrl.text.trim(),
                        );

                        context.read<AppointmentRepository>().bookAppointment(newAppt);
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Appuntamento per $name registrato con successo!'),
                            backgroundColor: AppColors.emerald,
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.obsidianBlack,
                        foregroundColor: AppColors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Conferma Prenotazione', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ─── MODALE FERIE / BLOCCO ORARIO ──────────────────────────────────────────
  void _showBlockTimeSheet(BuildContext context, String salonName) {
    String staff = 'Tutti';
    String reason = 'Pausa Pranzo';
    String startTime = '13:00';
    int durationMinutes = 60;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          return Container(
            decoration: const BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            padding: EdgeInsets.only(
              top: 16,
              left: 20,
              right: 20,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.zinc300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Blocca Orario (Pausa / Ferie)',
                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: AppColors.zinc900),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(ctx),
                      icon: const Icon(Icons.close, color: AppColors.zinc400),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                DropdownButtonFormField<String>(
                  value: staff,
                  decoration: InputDecoration(
                    labelText: 'Operatore interessato',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'Tutti', child: Text('Tutti (Chiusura Salone)')),
                    DropdownMenuItem(value: 'Marco', child: Text('Marco')),
                    DropdownMenuItem(value: 'Elena', child: Text('Elena')),
                    DropdownMenuItem(value: 'Luca', child: Text('Luca')),
                  ],
                  onChanged: (val) => setModalState(() => staff = val ?? staff),
                ),

                const SizedBox(height: 12),

                DropdownButtonFormField<String>(
                  value: reason,
                  decoration: InputDecoration(
                    labelText: 'Motivo Blocco',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'Pausa Pranzo', child: Text('Pausa Pranzo')),
                    DropdownMenuItem(value: 'Ferie / Riposo', child: Text('Ferie / Riposo')),
                    DropdownMenuItem(value: 'Permesso Personale', child: Text('Permesso Personale')),
                    DropdownMenuItem(value: 'Corso Aggiornamento', child: Text('Corso Aggiornamento')),
                  ],
                  onChanged: (val) => setModalState(() => reason = val ?? reason),
                ),

                const SizedBox(height: 12),

                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: startTime,
                        decoration: InputDecoration(
                          labelText: 'Ora Inizio',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        ),
                        items: _timeSlots.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                        onChanged: (val) => setModalState(() => startTime = val ?? startTime),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        value: durationMinutes,
                        decoration: InputDecoration(
                          labelText: 'Durata',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        ),
                        items: const [
                          DropdownMenuItem(value: 30, child: Text('30 minuti')),
                          DropdownMenuItem(value: 60, child: Text('1 ora')),
                          DropdownMenuItem(value: 120, child: Text('2 ore')),
                          DropdownMenuItem(value: 480, child: Text('Tutto il giorno')),
                        ],
                        onChanged: (val) => setModalState(() => durationMinutes = val ?? 60),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () {
                      final hour = int.parse(startTime.split(':')[0]);
                      final start = DateTime(
                        _selectedDate.year,
                        _selectedDate.month,
                        _selectedDate.day,
                        hour,
                        0,
                      );
                      final end = start.add(Duration(minutes: durationMinutes));

                      context.read<AppointmentRepository>().blockTimeSlot(
                            salonId: 'salon-1',
                            staffName: staff,
                            reason: reason,
                            startTime: start,
                            endTime: end,
                          );

                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Blocco $reason registrato con successo!'),
                          backgroundColor: const Color(0xFFB45309),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFB45309),
                      foregroundColor: AppColors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Registra Blocco Orario', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  // ─── NOTIFICHE SHEET ───────────────────────────────────────────────────────
  void _showNotificationsSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.notifications_active, color: AppColors.obsidianBlack),
                SizedBox(width: 8),
                Text('Notifiche Salone', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ],
            ),
            const SizedBox(height: 16),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(
                backgroundColor: AppColors.emeraldLight,
                child: Icon(Icons.check, color: AppColors.emerald, size: 18),
              ),
              title: const Text('Nuova prenotazione online', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: const Text('Mario Rossi ha prenotato Taglio & Piega per oggi alle 10:00', style: TextStyle(fontSize: 11)),
              trailing: const Text('10m fa', style: TextStyle(fontSize: 10, color: AppColors.zinc400)),
            ),
            const Divider(),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(
                backgroundColor: AppColors.roseLight,
                child: Icon(Icons.inventory_2, color: AppColors.rose, size: 18),
              ),
              title: const Text('Allerta Scorte Magazzino', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: const Text('Olio Argan Puro 100ml è sotto la scorta minima (1 pz rimasti)', style: TextStyle(fontSize: 11)),
              trailing: const Text('1h fa', style: TextStyle(fontSize: 10, color: AppColors.zinc400)),
            ),
          ],
        ),
      ),
    );
  }
}
