import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/salon_model.dart';
import '../../data/models/service_model.dart';
import '../../data/models/appointment_model.dart';
import '../../data/repositories/salon_repository.dart';
import '../../data/repositories/appointment_repository.dart';
import '../../data/repositories/auth_repository.dart';

class BookingWizardScreen extends StatefulWidget {
  final Salon salon;

  const BookingWizardScreen({super.key, required this.salon});

  @override
  State<BookingWizardScreen> createState() => _BookingWizardScreenState();
}

class _BookingWizardScreenState extends State<BookingWizardScreen> {
  int _currentStep = 0; // 0: Servizio, 1: Stylist, 2: Data/Ora, 3: Riepilogo
  
  SalonService? _selectedService;
  late String _selectedStaff;
  DateTime _selectedDate = DateTime.now();
  String _selectedSlot = '10:30';
  bool _isBooking = false;

  late final List<String> _staffList;

  final List<String> _timeSlots = [
    '09:00', '09:45', '10:30', '11:15', '14:30', '15:15', '16:00', '17:30', '18:15'
  ];

  @override
  void initState() {
    super.initState();
    _staffList = [
      'Qualsiasi Operatore Disponibile',
      'Titolare - ${widget.salon.name}',
      'Staff Specializzato Trimmy',
    ];
    _selectedStaff = _staffList.first;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SalonRepository>().syncSalonServices(widget.salon.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final services = context.watch<SalonRepository>().services;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : AppColors.zinc50,
      appBar: AppBar(
        title: Text(widget.salon.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(40),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: List.generate(4, (index) {
                final isActive = index <= _currentStep;
                return Expanded(
                  child: Container(
                    height: 4,
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    decoration: BoxDecoration(
                      color: isActive
                          ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                          : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
      body: _buildCurrentStep(services, isDark),
      bottomNavigationBar: _buildBottomBar(isDark),
    );
  }

  Widget _buildCurrentStep(List<SalonService> services, bool isDark) {
    switch (_currentStep) {
      case 0:
        return _buildServiceSelection(services, isDark);
      case 1:
        return _buildStaffSelection(isDark);
      case 2:
        return _buildDateTimeSelection(isDark);
      case 3:
      default:
        return _buildConfirmationSummary(isDark);
    }
  }

  // STEP 1: Scelta Trattamento Reale
  Widget _buildServiceSelection(List<SalonService> services, bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          '1. Seleziona il Trattamento',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : AppColors.zinc900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Scegli il servizio desiderato con tariffa e durata garantita dal salone.',
          style: TextStyle(fontSize: 12, color: isDark ? Colors.white60 : AppColors.zinc500),
        ),
        const SizedBox(height: 16),
        if (services.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Column(
                children: [
                  Icon(Icons.content_cut, size: 40, color: isDark ? Colors.white24 : AppColors.zinc300),
                  const SizedBox(height: 12),
                  Text(
                    'Caricamento listino ufficiale...',
                    style: TextStyle(color: isDark ? Colors.white54 : AppColors.zinc500, fontSize: 13),
                  ),
                ],
              ),
            ),
          )
        else
          ...services.map((service) {
            final isSelected = _selectedService?.id == service.id;
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isSelected
                      ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                      : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
                  width: isSelected ? 2 : 1,
                ),
              ),
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                onTap: () => setState(() => _selectedService = service),
                title: Text(
                  service.name,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color: isDark ? Colors.white : AppColors.zinc900,
                  ),
                ),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (service.description.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        service.description,
                        style: TextStyle(fontSize: 11, color: isDark ? Colors.white60 : AppColors.zinc500),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(Icons.access_time, size: 12, color: isDark ? Colors.white54 : AppColors.zinc400),
                        const SizedBox(width: 4),
                        Text(
                          '${service.durationMinutes} min',
                          style: TextStyle(fontSize: 11, color: isDark ? Colors.white70 : AppColors.zinc600),
                        ),
                        const SizedBox(width: 10),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            service.category,
                            style: TextStyle(fontSize: 10, color: isDark ? Colors.white70 : AppColors.zinc600),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                trailing: Text(
                  '€${service.price.toStringAsFixed(0)}',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: isDark ? AppColors.gold : AppColors.zinc900,
                  ),
                ),
              ),
            );
          }),
      ],
    );
  }

  // STEP 2: Scelta Operatore
  Widget _buildStaffSelection(bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          '2. Scegli il tuo Stylist di Fiducia',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : AppColors.zinc900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Oppure lascia che il sistema assegni il primo professionista del salone libero.',
          style: TextStyle(fontSize: 12, color: isDark ? Colors.white60 : AppColors.zinc500),
        ),
        const SizedBox(height: 16),
        ..._staffList.map((staff) {
          final isSelected = _selectedStaff == staff;
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isSelected
                    ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                    : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
                width: isSelected ? 2 : 1,
              ),
            ),
            child: ListTile(
              onTap: () => setState(() => _selectedStaff = staff),
              leading: CircleAvatar(
                backgroundColor: isSelected
                    ? (isDark ? const Color(0xFF332915) : AppColors.obsidianBlack)
                    : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100),
                child: Icon(
                  Icons.person,
                  color: isSelected
                      ? (isDark ? AppColors.gold : AppColors.white)
                      : (isDark ? Colors.white54 : AppColors.zinc500),
                  size: 20,
                ),
              ),
              title: Text(
                staff,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: isDark ? Colors.white : AppColors.zinc900,
                ),
              ),
              trailing: isSelected
                  ? Icon(Icons.check_circle, color: isDark ? AppColors.gold : AppColors.obsidianBlack)
                  : null,
            ),
          );
        }),
      ],
    );
  }

  // STEP 3: Data e Orario Live
  Widget _buildDateTimeSelection(bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          '3. Seleziona Data & Orario',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : AppColors.zinc900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Slot orari disponibili in tempo reale per questo salone.',
          style: TextStyle(fontSize: 12, color: isDark ? Colors.white60 : AppColors.zinc500),
        ),
        const SizedBox(height: 16),

        // Selezione Giorno (Prossimi 7 giorni)
        SizedBox(
          height: 70,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: 7,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final day = DateTime.now().add(Duration(days: index));
              final isSelected = _selectedDate.day == day.day && _selectedDate.month == day.month;

              return GestureDetector(
                onTap: () => setState(() => _selectedDate = day),
                child: Container(
                  width: 58,
                  decoration: BoxDecoration(
                    color: isSelected
                        ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                        : (isDark ? const Color(0xFF1E1E1E) : AppColors.white),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isSelected
                          ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                          : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        DateFormat('E', 'it_IT').format(day).toUpperCase(),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isSelected
                              ? (isDark ? AppColors.obsidianBlack : AppColors.zinc400)
                              : (isDark ? Colors.white54 : AppColors.zinc500),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${day.day}',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: isSelected
                              ? (isDark ? AppColors.obsidianBlack : AppColors.white)
                              : (isDark ? Colors.white : AppColors.zinc900),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),

        const SizedBox(height: 24),
        Text(
          'Orari Disponibili',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : AppColors.zinc900,
          ),
        ),
        const SizedBox(height: 12),

        // Grid Orari
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: _timeSlots.map((slot) {
            final isSelected = _selectedSlot == slot;
            return GestureDetector(
              onTap: () => setState(() => _selectedSlot = slot),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                decoration: BoxDecoration(
                  color: isSelected
                      ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                      : (isDark ? const Color(0xFF1E1E1E) : AppColors.white),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isSelected
                        ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                        : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
                  ),
                ),
                child: Text(
                  slot,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                    color: isSelected
                        ? (isDark ? AppColors.obsidianBlack : AppColors.white)
                        : (isDark ? Colors.white70 : AppColors.zinc800),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  // STEP 4: Riepilogo & Conferma
  Widget _buildConfirmationSummary(bool isDark) {
    final services = context.read<SalonRepository>().services;
    final service = _selectedService ?? (services.isNotEmpty ? services.first : const SalonService(
      id: 'srv-std',
      name: 'Trattamento Salone',
      category: 'Taglio',
      price: 30.0,
      durationMinutes: 30,
      description: '',
    ));
    final pointsEarned = (service.price * 0.10).floor();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          '4. Riepilogo Prenotazione',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : AppColors.zinc900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Verifica i dettagli prima di confermare il tuo appuntamento.',
          style: TextStyle(fontSize: 12, color: isDark ? Colors.white60 : AppColors.zinc500),
        ),
        const SizedBox(height: 16),

        // Card Riepilogo Dettagliata
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.salon.name,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : AppColors.zinc900,
                ),
              ),
              Text(
                '${widget.salon.address}, ${widget.salon.city}',
                style: TextStyle(fontSize: 12, color: isDark ? Colors.white60 : AppColors.zinc500),
              ),
              Divider(height: 24, color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
              _summaryRow('Trattamento', service.name, isDark),
              _summaryRow('Stylist', _selectedStaff, isDark),
              _summaryRow('Data', DateFormat('d MMMM yyyy', 'it_IT').format(_selectedDate), isDark),
              _summaryRow('Orario', 'Ore $_selectedSlot (${service.durationMinutes} min)', isDark),
              Divider(height: 24, color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Totale da saldare in salone',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: isDark ? Colors.white70 : AppColors.zinc800,
                    ),
                  ),
                  Text(
                    '€${service.price.toStringAsFixed(2)}',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: isDark ? AppColors.gold : AppColors.zinc900,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Box Punti Fedeltà Guadagnati
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF332915) : AppColors.goldSurface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.gold.withOpacity(0.3)),
          ),
          child: Row(
            children: [
              const Icon(Icons.stars, color: AppColors.gold, size: 24),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Con questa visita accumulerai +$pointsEarned Punti VIP Club sulla tua tessera fedeltà Trimmy.',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.gold),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _summaryRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : AppColors.zinc500)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : AppColors.zinc800,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(bool isDark) {
    final isLastStep = _currentStep == 3;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
        border: Border(top: BorderSide(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              if (_currentStep > 0) ...[
                OutlinedButton(
                  onPressed: () => setState(() => _currentStep--),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                  child: const Text('Indietro'),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: ElevatedButton(
                  onPressed: _isBooking
                      ? null
                      : () {
                          final services = context.read<SalonRepository>().services;
                          if (_selectedService == null && _currentStep == 0 && services.isNotEmpty) {
                            _selectedService = services.first;
                          }

                          if (isLastStep) {
                            _confirmBooking();
                          } else {
                            setState(() => _currentStep++);
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
                    foregroundColor: isDark ? AppColors.obsidianBlack : AppColors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: _isBooking
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: AppColors.white, strokeWidth: 2),
                        )
                      : Text(
                          isLastStep ? 'Conferma e Salva Appuntamento' : 'Continua',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _confirmBooking() async {
    setState(() => _isBooking = true);
    final services = context.read<SalonRepository>().services;
    final service = _selectedService ?? (services.isNotEmpty ? services.first : const SalonService(
      id: 'srv-std',
      name: 'Trattamento Salone',
      category: 'Taglio',
      price: 30.0,
      durationMinutes: 30,
      description: '',
    ));
    final user = context.read<AuthRepository>().currentUser;

    // Crea l'appuntamento
    final newAppt = Appointment(
      id: 'appt-${DateTime.now().millisecondsSinceEpoch}',
      salonId: widget.salon.id,
      salonName: widget.salon.name,
      salonAddress: widget.salon.address,
      customerId: user?.id ?? 'client-1',
      customerName: user?.displayName ?? 'Cliente Trimmy',
      customerPhone: user?.phone ?? '+39 340 1234567',
      serviceId: service.id,
      serviceName: service.name,
      servicePrice: service.price,
      staffId: 'staff-1',
      staffName: _selectedStaff,
      startTime: DateTime(
        _selectedDate.year,
        _selectedDate.month,
        _selectedDate.day,
        int.parse(_selectedSlot.split(':')[0]),
        int.parse(_selectedSlot.split(':')[1]),
      ),
      endTime: DateTime(
        _selectedDate.year,
        _selectedDate.month,
        _selectedDate.day,
        int.parse(_selectedSlot.split(':')[0]),
        int.parse(_selectedSlot.split(':')[1]) + service.durationMinutes,
      ),
      status: AppointmentStatus.confirmed,
    );

    await context.read<AppointmentRepository>().bookAppointment(newAppt);
    setState(() => _isBooking = false);

    if (!mounted) return;

    // Mostra il Boarding Pass VIP di successo
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SuccessBoardingPass(appointment: newAppt),
    ).then((_) {
      Navigator.pop(context);
    });
  }
}

class _SuccessBoardingPass extends StatelessWidget {
  final Appointment appointment;

  const _SuccessBoardingPass({required this.appointment});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF3A3A3A) : AppColors.zinc300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFFECFDF5),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle, color: AppColors.emeraldGreen, size: 48),
            ),
            const SizedBox(height: 16),
            Text(
              'Appuntamento Confermato!',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : AppColors.zinc900,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Registrato con successo nel Cloud del Salone.',
              style: TextStyle(fontSize: 13, color: isDark ? Colors.white60 : AppColors.zinc500),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: isDark ? const Color(0xFF3A3A3A) : AppColors.zinc200),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Salone', style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : AppColors.zinc500)),
                      Text(appointment.salonName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Trattamento', style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : AppColors.zinc500)),
                      Text(appointment.serviceName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Data & Ora', style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : AppColors.zinc500)),
                      Text(
                        '${DateFormat('dd/MM/yyyy').format(appointment.startTime)} ore ${DateFormat('HH:mm').format(appointment.startTime)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.emeraldGreen),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
                  foregroundColor: isDark ? AppColors.obsidianBlack : AppColors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Chiudi e Vai ai Miei Appuntamenti', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
