import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../data/repositories/checkout_repository.dart';
import '../../data/repositories/appointment_repository.dart';
import '../../data/repositories/auth_repository.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  String _selectedPeriod = 'Oggi';
  final List<String> _periods = ['Oggi', '7 Giorni', '30 Giorni', 'Anno'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authRepo = context.read<AuthRepository>();
      final salonId = authRepo.currentUser?.salonId ?? authRepo.currentUser?.uid ?? 'salone_default';
      context.read<CheckoutRepository>().setSalon(salonId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final checkoutRepo = context.watch<CheckoutRepository>();
    final apptRepo = context.watch<AppointmentRepository>();

    final now = DateTime.now();

    // Filtra scontrini in base al periodo selezionato
    final filteredReceipts = checkoutRepo.allReceipts.where((r) {
      if (r.isVoided) return false;
      if (_selectedPeriod == 'Oggi') {
        return r.issuedAt.year == now.year && r.issuedAt.month == now.month && r.issuedAt.day == now.day;
      } else if (_selectedPeriod == '7 Giorni') {
        return r.issuedAt.isAfter(now.subtract(const Duration(days: 7)));
      } else if (_selectedPeriod == '30 Giorni') {
        return r.issuedAt.isAfter(now.subtract(const Duration(days: 30)));
      } else {
        return r.issuedAt.year == now.year;
      }
    }).toList();

    // Filtra appuntamenti
    final filteredAppts = apptRepo.allAppointments.where((a) {
      if (_selectedPeriod == 'Oggi') {
        return a.date.year == now.year && a.date.month == now.month && a.date.day == now.day;
      } else if (_selectedPeriod == '7 Giorni') {
        return a.date.isAfter(now.subtract(const Duration(days: 7)));
      } else if (_selectedPeriod == '30 Giorni') {
        return a.date.isAfter(now.subtract(const Duration(days: 30)));
      } else {
        return a.date.year == now.year;
      }
    }).toList();

    // Calcolo KPI reali
    final double revenue = filteredReceipts.fold(0.0, (acc, r) => acc + r.finalAmount);
    final int appts = filteredAppts.length;
    final Set<String> distinctClients = {};
    for (final r in filteredReceipts) {
      if (r.customerName.isNotEmpty) distinctClients.add(r.customerName);
    }
    for (final a in filteredAppts) {
      if (a.customerName.isNotEmpty) distinctClients.add(a.customerName);
    }
    final int clients = distinctClients.length;
    final int txCount = filteredReceipts.length;
    final double averageTicket = txCount > 0 ? (revenue / txCount) : 0.0;

    // Ripartizione pagamenti
    double cardTotal = 0.0;
    double cashTotal = 0.0;
    double satispayTotal = 0.0;
    for (final r in filteredReceipts) {
      if (r.paymentMethod == 'CARTA_POS' || r.paymentMethod == 'CARD') {
        cardTotal += r.finalAmount;
      } else if (r.paymentMethod == 'CONTANTI' || r.paymentMethod == 'CASH') {
        cashTotal += r.finalAmount;
      } else if (r.paymentMethod == 'SATISPAY') {
        satispayTotal += r.finalAmount;
      } else if (r.paymentMethod == 'MISTO' || r.paymentMethod == 'MIXED') {
        cashTotal += r.cashAmount ?? 0.0;
        cardTotal += r.cardAmount ?? 0.0;
      }
    }
    final double posPercentage = revenue > 0 ? (cardTotal / revenue) : 0.0;
    final double cashPercentage = revenue > 0 ? (cashTotal / revenue) : 0.0;

    // Trattamenti più richiesti reali
    final Map<String, int> treatmentCount = {};
    final Map<String, double> treatmentRev = {};
    for (final r in filteredReceipts) {
      for (final it in r.items) {
        treatmentCount[it.name] = (treatmentCount[it.name] ?? 0) + it.quantity;
        treatmentRev[it.name] = (treatmentRev[it.name] ?? 0.0) + it.totalPrice;
      }
    }
    final sortedTreatments = treatmentRev.keys.toList()
      ..sort((a, b) => (treatmentRev[b] ?? 0.0).compareTo(treatmentRev[a] ?? 0.0));

    final maxRev = sortedTreatments.isNotEmpty ? (treatmentRev[sortedTreatments.first] ?? 1.0) : 1.0;

    return Scaffold(
      backgroundColor: AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Statistiche & Andamento Salone', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        backgroundColor: AppColors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Selettore Periodo Temporale
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppColors.zinc100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: _periods.map((period) {
                  final isSelected = _selectedPeriod == period;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedPeriod = period),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: isSelected
                              ? [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.06),
                                    blurRadius: 4,
                                    offset: const Offset(0, 1),
                                  ),
                                ]
                              : null,
                        ),
                        child: Text(
                          period,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            color: isSelected ? AppColors.zinc900 : AppColors.zinc500,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),

            const SizedBox(height: 20),

            // Griglia KPI
            Row(
              children: [
                Expanded(
                  child: _buildKpiCard(
                    title: 'Incasso Totale Reale',
                    value: '€${revenue.toStringAsFixed(2)}',
                    icon: Icons.euro,
                    color: AppColors.emerald,
                    subtitle: '$txCount scontrini emessi',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildKpiCard(
                    title: 'Appuntamenti',
                    value: '$appts',
                    icon: Icons.calendar_today,
                    color: AppColors.gold,
                    subtitle: 'in questo periodo',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildKpiCard(
                    title: 'Scontrino Medio',
                    value: '€${averageTicket.toStringAsFixed(2)}',
                    icon: Icons.receipt_long,
                    color: AppColors.indigo,
                    subtitle: 'per transazione',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildKpiCard(
                    title: 'Clienti Unici',
                    value: '$clients',
                    icon: Icons.people_outline,
                    color: Colors.purple.shade700,
                    subtitle: 'serviti e registrati',
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // Trattamenti Più Richiesti Reali
            const Text(
              'Trattamenti & Prodotti Più Venduti',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.zinc900),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.zinc200),
              ),
              child: sortedTreatments.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Text(
                          'Nessuna voce incassata nel periodo selezionato.\nGli scontrini emessi dal POS appariranno qui.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.zinc400, fontSize: 12),
                        ),
                      ),
                    )
                  : Column(
                      children: sortedTreatments.take(5).map((name) {
                        final count = treatmentCount[name] ?? 0;
                        final rev = treatmentRev[name] ?? 0.0;
                        final ratio = maxRev > 0 ? (rev / maxRev).clamp(0.05, 1.0) : 0.1;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _buildServiceProgressBar(name, ratio, '$count venduti', '€${rev.toStringAsFixed(2)}'),
                        );
                      }).toList(),
                    ),
            ),

            const SizedBox(height: 24),

            // Ripartizione Metodi di Incasso
            const Text(
              'Ripartizione Pagamenti Reale',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.zinc900),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.zinc200),
              ),
              child: revenue == 0
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('Nessun incasso nel periodo selezionato.', style: TextStyle(color: AppColors.zinc400, fontSize: 12)),
                      ),
                    )
                  : Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Icon(Icons.credit_card, size: 18, color: Colors.blue.shade700),
                                const SizedBox(width: 8),
                                const Text('Carte & POS Elettronico', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                              ],
                            ),
                            Text('${(posPercentage * 100).toStringAsFixed(0)}% (e ${cardTotal.toStringAsFixed(2)})', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        LinearProgressIndicator(
                          value: posPercentage,
                          backgroundColor: AppColors.zinc100,
                          valueColor: AlwaysStoppedAnimation(Colors.blue.shade700),
                          borderRadius: BorderRadius.circular(6),
                          minHeight: 6,
                        ),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.payments_outlined, size: 18, color: AppColors.emerald),
                                SizedBox(width: 8),
                                Text('Contanti in Cassa', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                              ],
                            ),
                            Text('${(cashPercentage * 100).toStringAsFixed(0)}% (e ${cashTotal.toStringAsFixed(2)})', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        LinearProgressIndicator(
                          value: cashPercentage,
                          backgroundColor: AppColors.zinc100,
                          valueColor: const AlwaysStoppedAnimation(AppColors.emerald),
                          borderRadius: BorderRadius.circular(6),
                          minHeight: 6,
                        ),
                        if (satispayTotal > 0) ...[
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Row(
                                children: [
                                  Icon(Icons.qr_code, size: 18, color: AppColors.rose),
                                  SizedBox(width: 8),
                                  Text('Satispay / Digitale', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                ],
                              ),
                              Text('€ ${satispayTotal.toStringAsFixed(2)}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ],
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
    required String subtitle,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.zinc200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(fontSize: 11, color: AppColors.zinc500, fontWeight: FontWeight.w600)),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: color),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.zinc900)),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(fontSize: 10, color: AppColors.zinc400)),
        ],
      ),
    );
  }

  Widget _buildServiceProgressBar(String title, double progress, String count, String revenue) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.zinc800),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text('$count • $revenue', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.zinc600)),
          ],
        ),
        const SizedBox(height: 6),
        LinearProgressIndicator(
          value: progress,
          backgroundColor: AppColors.zinc100,
          valueColor: const AlwaysStoppedAnimation(AppColors.obsidianBlack),
          borderRadius: BorderRadius.circular(6),
          minHeight: 5,
        ),
      ],
    );
  }
}
