import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  String _selectedPeriod = '7 Giorni';
  final List<String> _periods = ['Oggi', '7 Giorni', '30 Giorni', 'Anno'];

  @override
  Widget build(BuildContext context) {
    // Dati dinamici in base al periodo selezionato
    final double revenue = _selectedPeriod == 'Oggi'
        ? 345.00
        : (_selectedPeriod == '7 Giorni' ? 2450.00 : (_selectedPeriod == '30 Giorni' ? 9820.00 : 118400.00));
    final int appts = _selectedPeriod == 'Oggi'
        ? 8
        : (_selectedPeriod == '7 Giorni' ? 54 : (_selectedPeriod == '30 Giorni' ? 218 : 2650));
    final int clients = _selectedPeriod == 'Oggi' ? 7 : (_selectedPeriod == '7 Giorni' ? 46 : 142);
    final double averageTicket = revenue / (appts > 0 ? appts : 1);

    return Scaffold(
      backgroundColor: AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Statistiche & Performance', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
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
                    title: 'Incasso Totale',
                    value: '€${revenue.toStringAsFixed(2)}',
                    icon: Icons.euro,
                    color: AppColors.emeraldGreen,
                    trend: '+14% vs prec.',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildKpiCard(
                    title: 'Appuntamenti',
                    value: '$appts',
                    icon: Icons.calendar_today,
                    color: AppColors.accentOrange,
                    trend: '+6 confermati',
                  ),
                ),
              ],
            ),
            const SizedBox(width: 12),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildKpiCard(
                    title: 'Scontrino Medio',
                    value: '€${averageTicket.toStringAsFixed(2)}',
                    icon: Icons.receipt_long,
                    color: Colors.blue.shade700,
                    trend: 'Stabile',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildKpiCard(
                    title: 'Clienti Serviti',
                    value: '$clients',
                    icon: Icons.people_outline,
                    color: Colors.purple.shade700,
                    trend: '+12 nuovi',
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // Trattamenti Più Richiesti
            const Text(
              'Trattamenti Più Richiesti',
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
              child: Column(
                children: [
                  _buildServiceProgressBar('Taglio Sartoriale & Piega', 0.85, '85 prenotazioni', '€3,825'),
                  const SizedBox(height: 14),
                  _buildServiceProgressBar('Balayage Sfumato & Gloss', 0.55, '55 prenotazioni', '€5,225'),
                  const SizedBox(height: 14),
                  _buildServiceProgressBar('Piega & Styling Glamour', 0.40, '40 prenotazioni', '€1,000'),
                  const SizedBox(height: 14),
                  _buildServiceProgressBar('Rasatura Tradizionale Panno Caldo', 0.28, '28 prenotazioni', '€616'),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Ripartizione Metodi di Incasso
            const Text(
              'Ripartizione Pagamenti',
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
              child: Column(
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
                      const Text('68%', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: 0.68,
                    backgroundColor: AppColors.zinc100,
                    valueColor: AlwaysStoppedAnimation(Colors.blue.shade700),
                    borderRadius: BorderRadius.circular(6),
                    minHeight: 6,
                  ),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.payments_outlined, size: 18, color: AppColors.emeraldGreen),
                          const SizedBox(width: 8),
                          const Text('Contanti Banco', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        ],
                      ),
                      const Text('32%', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: 0.32,
                    backgroundColor: AppColors.zinc100,
                    valueColor: AlwaysStoppedAnimation(AppColors.emeraldGreen),
                    borderRadius: BorderRadius.circular(6),
                    minHeight: 6,
                  ),
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
    required String trend,
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
              Text(title, style: const TextStyle(fontSize: 12, color: AppColors.zinc500)),
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
          const SizedBox(height: 10),
          Text(
            value,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.zinc900),
          ),
          const SizedBox(height: 4),
          Text(
            trend,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color),
          ),
        ],
      ),
    );
  }

  Widget _buildServiceProgressBar(String service, double progress, String count, String totalEur) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                service,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.zinc800),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(
              totalEur,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.zinc900),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Expanded(
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: AppColors.zinc100,
                valueColor: const AlwaysStoppedAnimation(AppColors.obsidianBlack),
                borderRadius: BorderRadius.circular(6),
                minHeight: 6,
              ),
            ),
            const SizedBox(width: 8),
            Text(count, style: const TextStyle(fontSize: 10, color: AppColors.zinc500)),
          ],
        ),
      ],
    );
  }
}
