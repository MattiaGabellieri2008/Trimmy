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

  final List<String> _agendaKeywords = [
    'Oggi',
    'Confermati',
    'Taglio',
    'Colore',
    'Completati',
    'Pausa',
  ];

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

  void _changeMonth(int deltaMonths) {
    setState(() {
      _selectedDate = DateTime(_selectedDate.year, _selectedDate.month + deltaMonths, 1);
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
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  List<DateTime> _getCurrentWeekDays(DateTime baseDate) {
    final weekday = baseDate.weekday; // 1 = lunedì, 7 = domenica
    final monday = baseDate.subtract(Duration(days: weekday - 1));
    return List.generate(7, (i) => monday.add(Duration(days: i)));
  }

  @override
  Widget build(BuildContext context) {
    final apptRepo = context.watch<AppointmentRepository>();
    final authRepo = context.watch<AuthRepository>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final salonId = authRepo.currentUser?.salonId ?? authRepo.currentUser?.uid ?? 'salone-default';
    final salonName = authRepo.currentUser?.salonName ?? authRepo.currentUser?.displayName ?? 'Salone Partner Trimmy';

    final allDayAppts = apptRepo.getSalonAppointments(salonId, _selectedDate);

    // Filtra per staff e per eventuale ricerca/parola chiave
    final filteredAppts = allDayAppts.where((a) {
      final matchesStaff = _selectedStaff == 'Tutti' || a.staffName.contains(_selectedStaff);
      
      bool matchesSearch = true;
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        if (q == 'confermati') {
          matchesSearch = a.status == AppointmentStatus.confirmed;
        } else if (q == 'completati') {
          matchesSearch = a.status == AppointmentStatus.completed;
        } else if (q == 'pausa') {
          matchesSearch = a.status == AppointmentStatus.blocked;
        } else {
          matchesSearch = a.customerName.toLowerCase().contains(q) ||
              a.serviceName.toLowerCase().contains(q) ||
              a.customerPhone.contains(q) ||
              a.staffName.toLowerCase().contains(q);
        }
      }
      return matchesStaff && matchesSearch;
    }).toList();

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : AppColors.white,
      body: SafeArea(
        child: Column(
          children: [
            // 1. TOP BAR REALE CON LOGO, RICERCA E NOTIFICHE
            _buildTopHeader(isDark),

            // 2. CHIP SUGGERIMENTI PAROLE CHIAVE AGENDA
            _buildKeywordChipsRow(isDark),

            // 3. CORPO SCROLLABILE CON CONTROLLI, AZIONI E LE DIVERSE VISTE
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  // Intestazione data estesa
                  _buildDateBanner(filteredAppts.length, isDark),

                  // Barra controlli (< Oggi >, Calendario, Modalità Vista Giorno/Settimana/Mese/Staff)
                  _buildControlsRow(isDark),

                  const SizedBox(height: 10),

                  // Barra azioni rapide (+ Prenota, Ferie, Banco, Z)
                  _buildActionButtonsRow(salonName, isDark),

                  const SizedBox(height: 14),

                  // Selettore dinamico vista: Giorno, Settimana, Mese, Staff
                  if (_viewMode == 'Giorno') ...[
                    // Striscia settimanale con bolle giorno e frecce < >
                    _buildWeekBubbleStrip(apptRepo, salonId, isDark),
                    const SizedBox(height: 12),
                    // Griglia Oraria Lavoro Giorno
                    _buildTimelineGrid(filteredAppts, salonId, salonName, isDark),
                  ] else if (_viewMode == 'Settimana') ...[
                    // VISTA SETTIMANALE REALE
                    _buildWeeklyView(apptRepo, salonId, salonName, isDark),
                  ] else if (_viewMode == 'Mese') ...[
                    // VISTA MENSILE REALE CON CALENDARIO & APPUNTAMENTI
                    _buildMonthlyView(apptRepo, salonId, salonName, isDark),
                  ] else if (_viewMode == 'Staff') ...[
                    _buildStaffFilterRow(salonName, isDark),
                    _buildTimelineGrid(filteredAppts, salonId, salonName, isDark),
                  ],

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
  Widget _buildTopHeader(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
        border: Border(bottom: BorderSide(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200, width: 1)),
      ),
      child: Row(
        children: [
          Text(
            'Trimmy.',
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 19,
              letterSpacing: -0.5,
              color: isDark ? AppColors.gold : AppColors.zinc900,
            ),
          ),
          const SizedBox(width: 12),

          // Barra di ricerca espansa
          Expanded(
            child: Container(
              height: 38,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: isDark ? const Color(0xFF3A3A3A) : AppColors.zinc200),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Row(
                children: [
                  const Icon(Icons.search, size: 18, color: AppColors.zinc400),
                  const SizedBox(width: 6),
                  Expanded(
                    child: TextField(
                      controller: _searchCtrl,
                      onChanged: (val) => setState(() => _searchQuery = val.trim()),
                      style: TextStyle(fontSize: 12, color: isDark ? Colors.white : AppColors.zinc900),
                      decoration: const InputDecoration(
                        hintText: 'Cerca cliente, servizio, telefono...',
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
                    color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: isDark ? const Color(0xFF3A3A3A) : AppColors.zinc200),
                  ),
                  child: Icon(Icons.notifications_none, size: 20, color: isDark ? Colors.white70 : AppColors.zinc700),
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

  // ─── 2. SUGGERIMENTI PAROLE CHIAVE AGENDA ──────────────────────────────────
  Widget _buildKeywordChipsRow(bool isDark) {
    return Container(
      color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      child: SizedBox(
        height: 28,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: _agendaKeywords.length,
          separatorBuilder: (_, __) => const SizedBox(width: 6),
          itemBuilder: (context, idx) {
            final kw = _agendaKeywords[idx];
            final isActive = _searchQuery.toLowerCase() == kw.toLowerCase() ||
                (kw == 'Oggi' && _isToday(_selectedDate) && _searchQuery.isEmpty);

            return ActionChip(
              label: Text(
                '#$kw',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                  color: isActive ? AppColors.gold : (isDark ? Colors.white70 : AppColors.zinc700),
                ),
              ),
              backgroundColor: isActive
                  ? (isDark ? const Color(0xFF332915) : const Color(0xFFFEF3C7))
                  : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100),
              side: BorderSide(
                color: isActive ? AppColors.gold : (isDark ? const Color(0xFF3A3A3A) : AppColors.zinc200),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              visualDensity: VisualDensity.compact,
              onPressed: () {
                if (kw == 'Oggi') {
                  _goToToday();
                  _searchCtrl.clear();
                  setState(() => _searchQuery = '');
                } else {
                  setState(() {
                    if (isActive) {
                      _searchCtrl.clear();
                      _searchQuery = '';
                    } else {
                      _searchCtrl.text = kw;
                      _searchQuery = kw;
                    }
                  });
                }
              },
            );
          },
        ),
      ),
    );
  }

  // ─── 3. DATA HEADER ────────────────────────────────────────────────────────
  Widget _buildDateBanner(int apptCount, bool isDark) {
    final dateStr = DateFormat('EEEE d MMMM yyyy', 'it_IT').format(_selectedDate);
    final capitalized = dateStr.isNotEmpty ? '${dateStr[0].toUpperCase()}${dateStr.substring(1)}' : dateStr;
    final isToday = _isToday(_selectedDate);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                capitalized,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: isDark ? Colors.white : AppColors.zinc900,
                  letterSpacing: -0.3,
                ),
              ),
              if (isToday) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.gold : AppColors.obsidianBlack,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'Oggi',
                    style: TextStyle(
                      color: isDark ? AppColors.obsidianBlack : AppColors.white,
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
            style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : AppColors.zinc500),
          ),
        ],
      ),
    );
  }

  // ─── 4. BARRA CONTROLLI (< Oggi >, 📅, Viste) ──────────────────────────────
  Widget _buildControlsRow(bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          // Navigazione giorno: < Oggi >
          Container(
            height: 34,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : AppColors.zinc100,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: Icon(Icons.chevron_left, size: 18, color: isDark ? Colors.white70 : AppColors.zinc700),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 30),
                  onPressed: () => _viewMode == 'Mese' ? _changeMonth(-1) : _changeDay(_viewMode == 'Settimana' ? -7 : -1),
                ),
                GestureDetector(
                  onTap: _goToToday,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Text(
                      'Oggi',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isDark ? AppColors.gold : AppColors.zinc900,
                      ),
                    ),
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.chevron_right, size: 18, color: isDark ? Colors.white70 : AppColors.zinc700),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 30),
                  onPressed: () => _viewMode == 'Mese' ? _changeMonth(1) : _changeDay(_viewMode == 'Settimana' ? 7 : 1),
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
              color: isDark ? const Color(0xFF1E1E1E) : AppColors.zinc100,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
            ),
            child: IconButton(
              icon: Icon(Icons.calendar_today_outlined, size: 16, color: isDark ? Colors.white70 : AppColors.zinc700),
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
                color: isDark ? const Color(0xFF1E1E1E) : AppColors.zinc100,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
              ),
              child: Row(
                children: ['Giorno', 'Settimana', 'Mese', 'Staff'].map((mode) {
                  final isSelected = _viewMode == mode;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _viewMode = mode),
                      child: Container(
                        decoration: BoxDecoration(
                          color: isSelected
                              ? (isDark ? AppColors.gold : AppColors.white)
                              : Colors.transparent,
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
                              color: isSelected
                                  ? (isDark ? AppColors.obsidianBlack : AppColors.zinc900)
                                  : (isDark ? Colors.white60 : AppColors.zinc500),
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

  // ─── 5. AZIONI RAPIDE (+ Prenota, Ferie, Banco, Z) ─────────────────────────
  Widget _buildActionButtonsRow(String salonName, bool isDark) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          // + Prenota
          ElevatedButton.icon(
            onPressed: () => _showNewAppointmentSheet(context, salonName),
            style: ElevatedButton.styleFrom(
              backgroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
              foregroundColor: isDark ? AppColors.obsidianBlack : AppColors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              elevation: 0,
            ),
            icon: const Icon(Icons.add, size: 16),
            label: const Text('Prenota', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          ),

          const SizedBox(width: 8),

          // Ferie / Pausa
          OutlinedButton.icon(
            onPressed: () => _showBlockTimeSheet(context, salonName),
            style: OutlinedButton.styleFrom(
              backgroundColor: isDark ? const Color(0xFF2A2000) : const Color(0xFFFFFBEB),
              foregroundColor: isDark ? AppColors.gold : const Color(0xFF78350F),
              side: BorderSide(color: isDark ? AppColors.gold.withOpacity(0.4) : const Color(0xFFFCD34D)),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            icon: const Icon(Icons.coffee, size: 16, color: AppColors.gold),
            label: const Text('Ferie', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          ),

          const SizedBox(width: 8),

          // Cassa Banco
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
            label: const Text('Banco POS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          ),

          const SizedBox(width: 8),

          // Chiusura Z Fiscale
          OutlinedButton.icon(
            onPressed: () {
              DailyCashClosingModal.show(
                context,
                salonName: salonName,
                date: _selectedDate,
              );
            },
            style: OutlinedButton.styleFrom(
              backgroundColor: isDark ? const Color(0xFF1E1E1E) : AppColors.zinc100,
              foregroundColor: isDark ? Colors.white70 : AppColors.zinc800,
              side: BorderSide(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc300),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            icon: const Icon(Icons.lock_outline, size: 15, color: Color(0xFFD97706)),
            label: const Text('Chiusura Z', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          ),
        ],
      ),
    );
  }

  // ─── 6. STRISCIA SETTIMANALE A BOLLE (PER VISTA GIORNO) ─────────────────────
  Widget _buildWeekBubbleStrip(AppointmentRepository apptRepo, String salonId, bool isDark) {
    final weekDays = _getCurrentWeekDays(_selectedDate);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
      ),
      child: Row(
        children: [
          IconButton(
            icon: Icon(Icons.chevron_left, size: 20, color: isDark ? Colors.white60 : AppColors.zinc500),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 24),
            onPressed: () => _changeDay(-7),
          ),
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
                        color: isSelected
                            ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                            : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc50),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected
                              ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                              : (isDark ? const Color(0xFF3A3A3A) : AppColors.zinc200),
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
                              color: isSelected
                                  ? (isDark ? AppColors.obsidianBlack : AppColors.zinc400)
                                  : (isDark ? Colors.white54 : AppColors.zinc500),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${d.day}',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              color: isSelected
                                  ? (isDark ? AppColors.obsidianBlack : AppColors.white)
                                  : (isDark ? Colors.white : AppColors.zinc900),
                            ),
                          ),
                          const SizedBox(height: 3),
                          if (isToday)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                              decoration: BoxDecoration(
                                color: isSelected ? Colors.black : const Color(0xFFFEF3C7),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                'OGGI',
                                style: TextStyle(
                                  fontSize: 7,
                                  fontWeight: FontWeight.bold,
                                  color: isSelected ? AppColors.gold : const Color(0xFF92400E),
                                ),
                              ),
                            )
                          else if (dayAppts.isNotEmpty)
                            Container(
                              width: 5,
                              height: 5,
                              decoration: BoxDecoration(
                                color: isSelected ? Colors.black : AppColors.gold,
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
          IconButton(
            icon: Icon(Icons.chevron_right, size: 20, color: isDark ? Colors.white60 : AppColors.zinc500),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 24),
            onPressed: () => _changeDay(7),
          ),
        ],
      ),
    );
  }

  // ─── 7. VISTA SETTIMANALE COMPLETA ("Settimana") ─────────────────────────────
  Widget _buildWeeklyView(AppointmentRepository apptRepo, String salonId, String salonName, bool isDark) {
    final weekDays = _getCurrentWeekDays(_selectedDate);
    final firstDay = weekDays.first;
    final lastDay = weekDays.last;
    final weekRangeTitle = 'Settimana: ${firstDay.day} ${DateFormat('MMM', 'it_IT').format(firstDay)} - ${lastDay.day} ${DateFormat('MMM yyyy', 'it_IT').format(lastDay)}';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Banner Settimana con pulsanti < >
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left),
                  onPressed: () => _changeDay(-7),
                  constraints: const BoxConstraints(),
                  padding: EdgeInsets.zero,
                ),
                Text(
                  weekRangeTitle,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: isDark ? Colors.white : AppColors.zinc900,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right),
                  onPressed: () => _changeDay(7),
                  constraints: const BoxConstraints(),
                  padding: EdgeInsets.zero,
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // 7 Schede Giornaliere per la settimana
          ...weekDays.map((day) {
            final isToday = _isToday(day);
            final dayTitle = DateFormat('EEEE d MMMM', 'it_IT').format(day);
            final dayAppts = apptRepo.getSalonAppointments(salonId, day);

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isToday
                      ? AppColors.gold
                      : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
                  width: isToday ? 1.5 : 1,
                ),
              ),
              child: ExpansionTile(
                initiallyExpanded: isToday || dayAppts.isNotEmpty,
                shape: const Border(),
                tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: isToday
                        ? (isDark ? const Color(0xFF332915) : const Color(0xFFFEF3C7))
                        : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Center(
                    child: Text(
                      '${day.day}',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: isToday ? AppColors.gold : (isDark ? Colors.white : AppColors.zinc900),
                      ),
                    ),
                  ),
                ),
                title: Row(
                  children: [
                    Text(
                      dayTitle[0].toUpperCase() + dayTitle.substring(1),
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: isDark ? Colors.white : AppColors.zinc900,
                      ),
                    ),
                    if (isToday) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.gold,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'OGGI',
                          style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Colors.black),
                        ),
                      ),
                    ],
                  ],
                ),
                subtitle: Text(
                  '${dayAppts.length} appuntament${dayAppts.length == 1 ? 'o' : 'i'}',
                  style: TextStyle(fontSize: 11, color: isDark ? Colors.white54 : AppColors.zinc500),
                ),
                children: [
                  if (dayAppts.isEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Nessun appuntamento in programma',
                            style: TextStyle(fontSize: 12, color: isDark ? Colors.white38 : AppColors.zinc400, fontStyle: FontStyle.italic),
                          ),
                          TextButton.icon(
                            onPressed: () {
                              setState(() => _selectedDate = day);
                              _showNewAppointmentSheet(context, salonName);
                            },
                            icon: const Icon(Icons.add, size: 14, color: AppColors.gold),
                            label: const Text('Prenota', style: TextStyle(fontSize: 11, color: AppColors.gold, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                      child: Column(
                        children: dayAppts.map((appt) => _buildAppointmentCard(appt, isDark)).toList(),
                      ),
                    ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  // ─── 8. VISTA MENSILE COMPLETA ("Mese") ──────────────────────────────────────
  Widget _buildMonthlyView(AppointmentRepository apptRepo, String salonId, String salonName, bool isDark) {
    final year = _selectedDate.year;
    final month = _selectedDate.month;
    final monthTitle = DateFormat('MMMM yyyy', 'it_IT').format(_selectedDate);

    final daysInMonth = DateTime(year, month + 1, 0).day;
    final firstDayOfMonth = DateTime(year, month, 1);
    final firstWeekday = firstDayOfMonth.weekday; // 1 = lunedì

    final selectedDayAppts = apptRepo.getSalonAppointments(salonId, _selectedDate);

    final weekdays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Banner Navigazione Mese
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left),
                  onPressed: () => _changeMonth(-1),
                  constraints: const BoxConstraints(),
                  padding: EdgeInsets.zero,
                ),
                Text(
                  monthTitle[0].toUpperCase() + monthTitle.substring(1),
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color: isDark ? Colors.white : AppColors.zinc900,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right),
                  onPressed: () => _changeMonth(1),
                  constraints: const BoxConstraints(),
                  padding: EdgeInsets.zero,
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Griglia Calendario del Mese
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
            ),
            child: Column(
              children: [
                // Giorni della settimana header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: weekdays.map((wd) {
                    return SizedBox(
                      width: 36,
                      child: Center(
                        child: Text(
                          wd,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white54 : AppColors.zinc500,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),

                const SizedBox(height: 8),

                // Generatore celle giorni del mese
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: 42, // 6 righe x 7 colonne
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 7,
                    mainAxisSpacing: 6,
                    crossAxisSpacing: 4,
                  ),
                  itemBuilder: (context, idx) {
                    final dayNum = idx - (firstWeekday - 2);

                    if (dayNum < 1 || dayNum > daysInMonth) {
                      return const SizedBox();
                    }

                    final cellDate = DateTime(year, month, dayNum);
                    final isCellSelected = cellDate.day == _selectedDate.day &&
                        cellDate.month == _selectedDate.month &&
                        cellDate.year == _selectedDate.year;
                    final isCellToday = _isToday(cellDate);
                    final apptsOnCell = apptRepo.getSalonAppointments(salonId, cellDate);

                    return GestureDetector(
                      onTap: () => setState(() => _selectedDate = cellDate),
                      child: Container(
                        decoration: BoxDecoration(
                          color: isCellSelected
                              ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                              : (isCellToday
                                  ? (isDark ? const Color(0xFF332915) : const Color(0xFFFEF3C7))
                                  : Colors.transparent),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isCellSelected
                                ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                                : (isCellToday ? AppColors.gold : Colors.transparent),
                          ),
                        ),
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            Text(
                              '$dayNum',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: (isCellSelected || isCellToday) ? FontWeight.bold : FontWeight.normal,
                                color: isCellSelected
                                    ? (isDark ? AppColors.obsidianBlack : Colors.white)
                                    : (isDark ? Colors.white : AppColors.zinc900),
                              ),
                            ),
                            if (apptsOnCell.isNotEmpty)
                              Positioned(
                                bottom: 2,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: isCellSelected
                                        ? (isDark ? Colors.black : AppColors.gold)
                                        : AppColors.gold,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    '${apptsOnCell.length}',
                                    style: const TextStyle(
                                      fontSize: 7,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Sezione Appuntamenti del Giorno Selezionato nel Mese
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Dettaglio ${DateFormat('d MMMM', 'it_IT').format(_selectedDate)}',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: isDark ? Colors.white : AppColors.zinc900,
                ),
              ),
              Text(
                '${selectedDayAppts.length} appuntament${selectedDayAppts.length == 1 ? 'o' : 'i'}',
                style: const TextStyle(fontSize: 12, color: AppColors.gold, fontWeight: FontWeight.bold),
              ),
            ],
          ),

          const SizedBox(height: 8),

          if (selectedDayAppts.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
              ),
              child: Column(
                children: [
                  Icon(Icons.event_available, size: 36, color: isDark ? Colors.white24 : AppColors.zinc300),
                  const SizedBox(height: 8),
                  Text(
                    'Nessun appuntamento per questo giorno.',
                    style: TextStyle(color: isDark ? Colors.white54 : AppColors.zinc500, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                    onPressed: () => _showNewAppointmentSheet(context, salonName),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
                      foregroundColor: isDark ? AppColors.obsidianBlack : AppColors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Aggiungi Appuntamento', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            )
          else
            Column(
              children: selectedDayAppts.map((appt) => _buildAppointmentCard(appt, isDark)).toList(),
            ),
        ],
      ),
    );
  }

  // ─── 9. FILTRO STAFF ───────────────────────────────────────────────────────
  Widget _buildStaffFilterRow(String salonName, bool isDark) {
    final staffList = ['Tutti', 'Titolare', 'Master Stylist', 'Colorist'];

    return Container(
      height: 34,
      margin: const EdgeInsets.only(bottom: 12),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: staffList.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (context, i) {
          final staff = staffList[i];
          final isSelected = _selectedStaff == staff;
          return GestureDetector(
            onTap: () => setState(() => _selectedStaff = staff),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: isSelected
                    ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                    : (isDark ? const Color(0xFF1E1E1E) : AppColors.zinc100),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isSelected
                      ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                      : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
                ),
              ),
              child: Center(
                child: Text(
                  staff,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                    color: isSelected
                        ? (isDark ? AppColors.obsidianBlack : AppColors.white)
                        : (isDark ? Colors.white70 : AppColors.zinc700),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ─── 10. TABELLA ORARIA / TIMELINE GRID (VISTA GIORNO) ─────────────────────
  Widget _buildTimelineGrid(List<Appointment> dayAppts, String salonId, String salonName, bool isDark) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF252525) : const Color(0xFFF8FAFC),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
              border: Border(bottom: BorderSide(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200)),
            ),
            child: Row(
              children: [
                SizedBox(
                  width: 50,
                  child: Text(
                    'ORA',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white54 : AppColors.zinc500,
                    ),
                  ),
                ),
                Text(
                  'Orario di Lavoro & Appuntamenti',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white70 : AppColors.zinc600,
                  ),
                ),
              ],
            ),
          ),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _timeSlots.length,
            separatorBuilder: (_, __) => Divider(
              height: 1,
              color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF1F5F9),
            ),
            itemBuilder: (context, index) {
              final slotTime = _timeSlots[index];
              final slotHour = int.parse(slotTime.split(':')[0]);
              final slotAppts = dayAppts.where((a) => a.startTime.hour == slotHour).toList();

              return Container(
                constraints: const BoxConstraints(minHeight: 64),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 58,
                      padding: const EdgeInsets.only(top: 10, left: 12),
                      child: Text(
                        slotTime,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.white54 : AppColors.zinc400,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(4, 6, 8, 6),
                        child: slotAppts.isEmpty
                            ? _buildEmptySlot(slotTime, salonName, isDark)
                            : Column(
                                children: slotAppts.map((appt) => _buildAppointmentCard(appt, isDark)).toList(),
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

  Widget _buildEmptySlot(String slotTime, String salonName, bool isDark) {
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
              Icon(Icons.add_circle_outline, size: 14, color: isDark ? Colors.white24 : AppColors.zinc300),
              const SizedBox(width: 6),
              Text(
                'Disponibile • Tocca per prenotare',
                style: TextStyle(
                  fontSize: 11,
                  color: isDark ? Colors.white38 : AppColors.zinc400,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppointmentCard(Appointment appt, bool isDark) {
    final isBlocked = appt.status == AppointmentStatus.blocked;
    final isCompleted = appt.status == AppointmentStatus.completed;
    final isCancelled = appt.status == AppointmentStatus.cancelled;

    Color cardBg = isDark ? const Color(0xFF252525) : AppColors.white;
    Color borderCol = isDark ? const Color(0xFF333333) : AppColors.zinc200;
    Color badgeBg = isDark ? const Color(0xFF133B26) : AppColors.emeraldLight;
    Color badgeFg = AppColors.emerald;
    String badgeText = 'CONFERMATO';

    if (isBlocked) {
      cardBg = isDark ? const Color(0xFF332915) : const Color(0xFFFFFBEB);
      borderCol = isDark ? const Color(0xFF4D3810) : const Color(0xFFFDE68A);
      badgeBg = isDark ? const Color(0xFF4D3810) : const Color(0xFFFEF3C7);
      badgeFg = AppColors.gold;
      badgeText = 'PAUSA / FERIE';
    } else if (isCompleted) {
      cardBg = isDark ? const Color(0xFF132B1C) : const Color(0xFFF0FDF4);
      borderCol = isDark ? const Color(0xFF1E4D30) : const Color(0xFFBBF7D0);
      badgeBg = isDark ? const Color(0xFF1E4D30) : AppColors.emeraldLight;
      badgeFg = AppColors.emerald;
      badgeText = 'COMPLETATO';
    } else if (isCancelled) {
      cardBg = isDark ? const Color(0xFF3B151A) : const Color(0xFFFFF1F2);
      borderCol = isDark ? const Color(0xFF5C2028) : const Color(0xFFFECDD3);
      badgeBg = isDark ? const Color(0xFF5C2028) : AppColors.roseLight;
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
            color: Colors.black.withOpacity(isDark ? 0.3 : 0.02),
            blurRadius: 2,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    isBlocked ? Icons.coffee : Icons.access_time,
                    size: 13,
                    color: isBlocked ? AppColors.gold : (isDark ? Colors.white70 : AppColors.zinc600),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${DateFormat('HH:mm').format(appt.startTime)} - ${DateFormat('HH:mm').format(appt.endTime)}',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      color: isDark ? Colors.white : AppColors.zinc900,
                    ),
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
          Text(
            isBlocked ? appt.serviceName : appt.customerName,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 13,
              color: isDark ? Colors.white : AppColors.zinc900,
            ),
          ),
          if (!isBlocked) ...[
            Text(
              '${appt.serviceName} • € ${appt.servicePrice.toStringAsFixed(0)}',
              style: TextStyle(fontSize: 11, color: isDark ? Colors.white60 : AppColors.zinc600),
            ),
          ],
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.badge_outlined, size: 12, color: AppColors.gold),
              const SizedBox(width: 4),
              Text(
                appt.staffName,
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: isDark ? Colors.white54 : AppColors.zinc500),
              ),
              if (appt.customerPhone.isNotEmpty) ...[
                const Spacer(),
                const Icon(Icons.phone_outlined, size: 11, color: AppColors.gold),
                const SizedBox(width: 3),
                Text(
                  appt.customerPhone,
                  style: TextStyle(fontSize: 10, color: isDark ? Colors.white54 : AppColors.zinc500),
                ),
              ],
            ],
          ),
          if (!isBlocked && !isCompleted && !isCancelled) ...[
            Divider(height: 14, color: isDark ? const Color(0xFF333333) : const Color(0xFFE2E8F0)),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
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
                      color: isDark ? const Color(0xFF332915) : const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppColors.gold.withOpacity(0.5)),
                    ),
                    child: const Text(
                      'Incassa POS',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.gold),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
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

    String selectedStaff = 'Titolare - $salonName';
    String selectedTime = initialTime;
    SalonService? selectedService;

    final services = Provider.of<SalonRepository>(context, listen: false).services;
    if (services.isNotEmpty) {
      selectedService = services.first;
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          return Container(
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
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
                        color: isDark ? const Color(0xFF3A3A3A) : AppColors.zinc300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Nuovo Appuntamento',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 17,
                          color: isDark ? Colors.white : AppColors.zinc900,
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(ctx),
                        icon: const Icon(Icons.close, color: AppColors.zinc400),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  TextField(
                    controller: formNameCtrl,
                    decoration: const InputDecoration(labelText: 'Nome e Cognome Cliente'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: formPhoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: 'Numero di Telefono (per Notifica SMS)'),
                  ),

                  const SizedBox(height: 12),

                  if (services.isNotEmpty)
                    DropdownButtonFormField<SalonService>(
                      value: selectedService,
                      isExpanded: true,
                      dropdownColor: isDark ? const Color(0xFF2A2A2A) : AppColors.white,
                      decoration: const InputDecoration(labelText: 'Trattamento / Servizio'),
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

                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: selectedStaff,
                          isExpanded: true,
                          dropdownColor: isDark ? const Color(0xFF2A2A2A) : AppColors.white,
                          decoration: const InputDecoration(labelText: 'Operatore'),
                          items: [
                            DropdownMenuItem(value: 'Titolare - $salonName', child: Text('Titolare - $salonName', overflow: TextOverflow.ellipsis)),
                            const DropdownMenuItem(value: 'Master Stylist', child: Text('Master Stylist')),
                            const DropdownMenuItem(value: 'Colorist Senior', child: Text('Colorist Senior')),
                          ],
                          onChanged: (val) => setModalState(() => selectedStaff = val ?? selectedStaff),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: selectedTime,
                          dropdownColor: isDark ? const Color(0xFF2A2A2A) : AppColors.white,
                          decoration: const InputDecoration(labelText: 'Orario Inizio'),
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
                    decoration: const InputDecoration(labelText: 'Note Tecniche o Preferenze (opzionale)'),
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

                        final authRepo = Provider.of<AuthRepository>(context, listen: false);
                        final salonId = authRepo.currentUser?.salonId ?? authRepo.currentUser?.uid ?? 'salone-default';

                        final newAppt = Appointment(
                          id: 'appt-${DateTime.now().millisecondsSinceEpoch}',
                          salonId: salonId,
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
                            content: Text('Appuntamento per $name registrato con successo nel Cloud!'),
                            backgroundColor: AppColors.emerald,
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
                        foregroundColor: isDark ? AppColors.obsidianBlack : AppColors.white,
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          return Container(
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
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
                      color: isDark ? const Color(0xFF3A3A3A) : AppColors.zinc300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Blocca Orario (Pausa / Ferie)',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                        color: isDark ? Colors.white : AppColors.zinc900,
                      ),
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
                  dropdownColor: isDark ? const Color(0xFF2A2A2A) : AppColors.white,
                  decoration: const InputDecoration(labelText: 'Operatore interessato'),
                  items: [
                    const DropdownMenuItem(value: 'Tutti', child: Text('Tutti (Chiusura Salone)')),
                    DropdownMenuItem(value: 'Titolare', child: Text('Titolare ($salonName)')),
                    const DropdownMenuItem(value: 'Master Stylist', child: Text('Master Stylist')),
                  ],
                  onChanged: (val) => setModalState(() => staff = val ?? staff),
                ),

                const SizedBox(height: 12),

                DropdownButtonFormField<String>(
                  value: reason,
                  dropdownColor: isDark ? const Color(0xFF2A2A2A) : AppColors.white,
                  decoration: const InputDecoration(labelText: 'Motivo Blocco'),
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
                        dropdownColor: isDark ? const Color(0xFF2A2A2A) : AppColors.white,
                        decoration: const InputDecoration(labelText: 'Ora Inizio'),
                        items: _timeSlots.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                        onChanged: (val) => setModalState(() => startTime = val ?? startTime),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        value: durationMinutes,
                        dropdownColor: isDark ? const Color(0xFF2A2A2A) : AppColors.white,
                        decoration: const InputDecoration(labelText: 'Durata'),
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

                      final authRepo = Provider.of<AuthRepository>(context, listen: false);
                      final salonId = authRepo.currentUser?.salonId ?? authRepo.currentUser?.uid ?? 'salone-default';

                      context.read<AppointmentRepository>().blockTimeSlot(
                            salonId: salonId,
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.notifications_active, color: AppColors.gold),
                const SizedBox(width: 8),
                Text(
                  'Notifiche Salone in Tempo Reale',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: isDark ? Colors.white : AppColors.zinc900,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(
                backgroundColor: AppColors.emeraldLight,
                child: Icon(Icons.check, color: AppColors.emerald, size: 18),
              ),
              title: Text('Sincronizzazione Cloud Attiva', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: isDark ? Colors.white : AppColors.zinc900)),
              subtitle: Text('Tutti gli appuntamenti e i dati del salone sono sincronizzati su Firestore.', style: TextStyle(fontSize: 11, color: isDark ? Colors.white60 : AppColors.zinc500)),
              trailing: const Text('Adesso', style: TextStyle(fontSize: 10, color: AppColors.gold, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}
