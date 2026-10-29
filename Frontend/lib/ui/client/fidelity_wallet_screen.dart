import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/fidelity_model.dart';
import '../../data/repositories/fidelity_repository.dart';
import '../../data/repositories/auth_repository.dart';

class FidelityWalletScreen extends StatelessWidget {
  const FidelityWalletScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthRepository>().currentUser;
    final fidelityRepo = context.watch<FidelityRepository>();
    final loyalty = fidelityRepo.clientLoyalty;
    final packages = fidelityRepo.clientPackages;

    return Scaffold(
      backgroundColor: AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Tessera Fedeltà & Wallet', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 1. Digital VIP Pass Card (Apple Wallet style)
          _LuxuryVipCard(
            loyalty: loyalty,
            clientName: user?.displayName ?? 'Mario Rossi',
            onShowQr: () => _showQrModal(context, user?.id ?? 'VIP001'),
          ),

          const SizedBox(height: 24),

          // 2. Carnet & Pacchetti Prepagati (es. 5+1)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'I Miei Carnet & Pacchetti (5+1)',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.zinc900),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.indigoLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${packages.length} attivi',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.indigo),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          if (packages.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.zinc200),
              ),
              child: const Center(
                child: Text(
                  'Nessun carnet attivo.\nChiedi al tuo salone i pacchetti promozionali per risparmiare fino al 20%!',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.zinc500, fontSize: 12),
                ),
              ),
            )
          else
            ...packages.map((pkg) => _PackageCard(package: pkg)),

          const SizedBox(height: 24),

          // 3. Regole Raccolta Punti
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.zinc200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.stars, color: AppColors.gold, size: 20),
                    SizedBox(width: 8),
                    Text('Come Funziona il VIP Club', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  ],
                ),
                const SizedBox(height: 12),
                _benefitRow('1 punto ogni 10€ spesi su trattamenti e prodotti.'),
                _benefitRow('Ogni punto vale €0.10 di sconto immediato in cassa.'),
                _benefitRow('Soglia minima di riscatto: 50 punti (-€5.00).'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _benefitRow(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check_circle_outline, color: AppColors.emerald, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text, style: const TextStyle(fontSize: 12, color: AppColors.zinc600)),
          ),
        ],
      ),
    );
  }

  void _showQrModal(BuildContext context, String customerId) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.qr_code_2, size: 36, color: AppColors.obsidianBlack),
            const SizedBox(height: 12),
            const Text(
              'Pass Check-in Salone',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
            ),
            const SizedBox(height: 4),
            const Text(
              'Mostra questo codice alla cassa del salone per accumulare punti o scalare una seduta.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.zinc500),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.zinc50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.zinc200),
              ),
              child: QrImageView(
                data: 'TRM-$customerId',
                version: QrVersions.auto,
                size: 180.0,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'CODICE: TRM-${customerId.toUpperCase()}',
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 1),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.obsidianBlack,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Chiudi', style: TextStyle(color: AppColors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LuxuryVipCard extends StatelessWidget {
  final CustomerLoyalty loyalty;
  final String clientName;
  final VoidCallback onShowQr;

  const _LuxuryVipCard({
    required this.loyalty,
    required this.clientName,
    required this.onShowQr,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: AppColors.luxuryCardGradient,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Tessera
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'TRIMMY VIP PASS',
                    style: TextStyle(
                      color: AppColors.zinc400,
                      fontWeight: FontWeight.bold,
                      fontSize: 10,
                      letterSpacing: 1.5,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Atelier Bellezza Duomo',
                    style: TextStyle(color: AppColors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  gradient: AppColors.goldBadgeGradient,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  loyalty.tierLabel.toUpperCase(),
                  style: const TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 10,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 28),

          // Punti & Sconto
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('SALDO PUNTI', style: TextStyle(color: AppColors.zinc400, fontSize: 10, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        '${loyalty.pointsBalance}',
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 38,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -1,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'Punti',
                        style: TextStyle(color: AppColors.goldLight, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ],
                  ),
                ],
              ),

              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.white.withOpacity(0.15)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('VALORE SCONTO', style: TextStyle(color: AppColors.zinc400, fontSize: 9, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 2),
                    Text(
                      '€${loyalty.euroDiscountValue.toStringAsFixed(2)}',
                      style: const TextStyle(color: AppColors.white, fontWeight: FontWeight.w900, fontSize: 15),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Barra Progresso
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Prossimo livello: ${loyalty.nextThreshold} pt',
                    style: const TextStyle(color: AppColors.zinc400, fontSize: 11),
                  ),
                  Text(
                    '${loyalty.progressPercent}%',
                    style: const TextStyle(color: AppColors.goldLight, fontWeight: FontWeight.bold, fontSize: 11),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: loyalty.progressPercent / 100,
                  backgroundColor: AppColors.zinc800,
                  valueColor: const AlwaysStoppedAnimation<Color>(AppColors.goldLight),
                  minHeight: 5,
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),
          const Divider(color: AppColors.zinc800, height: 1),
          const SizedBox(height: 14),

          // Titolare & Tasto Mostra QR
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('TITOLARE', style: TextStyle(color: AppColors.zinc400, fontSize: 9, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(
                    clientName,
                    style: const TextStyle(color: AppColors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ],
              ),
              ElevatedButton.icon(
                onPressed: onShowQr,
                icon: const Icon(Icons.qr_code, size: 16),
                label: const Text('QR Cassa', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  foregroundColor: AppColors.obsidianBlack,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PackageCard extends StatelessWidget {
  final CustomerPackage package;

  const _PackageCard({required this.package});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.zinc200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  package.packageName,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.zinc900),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.emeraldLight,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${package.remainingSessions}/${package.totalSessions} rimaste',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: AppColors.emerald),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            package.serviceName,
            style: const TextStyle(fontSize: 12, color: AppColors.zinc500),
          ),
          const SizedBox(height: 14),

          // Pallini Sedute (1..N) con Wrap per evitare overflow su schermi compatti o pacchetti da 10+ sedute
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: List.generate(package.totalSessions, (index) {
              final isAvailable = index < package.remainingSessions;
              return Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: isAvailable ? AppColors.indigo : AppColors.zinc200,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Center(
                  child: Text(
                    '${index + 1}',
                    style: TextStyle(
                      color: isAvailable ? AppColors.white : AppColors.zinc400,
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                    ),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 12),
          Text(
            'Scade il ${DateFormat('d MMMM yyyy', 'it_IT').format(package.expiryDate)}',
            style: const TextStyle(fontSize: 11, color: AppColors.zinc400),
          ),
        ],
      ),
    );
  }
}
