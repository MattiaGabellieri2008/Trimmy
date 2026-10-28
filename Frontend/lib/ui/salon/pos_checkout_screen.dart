import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/service_model.dart';
import '../../data/repositories/salon_repository.dart';
import '../../data/repositories/fidelity_repository.dart';

class PosCheckoutScreen extends StatefulWidget {
  const PosCheckoutScreen({super.key});

  @override
  State<PosCheckoutScreen> createState() => _PosCheckoutScreenState();
}

class _PosCheckoutScreenState extends State<PosCheckoutScreen> {
  final List<SalonService> _cartItems = [];
  bool _useCarnetSession = false;
  int _loyaltyDiscount = 0; // Euro di sconto riscattati (es. 5, 10)
  String _customerName = 'Mario Rossi';

  @override
  void initState() {
    super.initState();
    // Default 1 servizio per simulare il checkout rapido
    final services = Provider.of<SalonRepository>(context, listen: false).services;
    if (services.isNotEmpty) {
      _cartItems.add(services.first);
    }
  }

  double get _subtotal => _cartItems.fold(0.0, (acc, item) => acc + item.price);
  double get _carnetDeduction => _useCarnetSession ? (_cartItems.isNotEmpty ? _cartItems.first.price : 0.0) : 0.0;
  double get _total => (_subtotal - _carnetDeduction - _loyaltyDiscount).clamp(0.0, 9999.0);
  int get _pointsEarned => (_total * 0.10).floor();

  @override
  Widget build(BuildContext context) {
    final services = context.watch<SalonRepository>().services;
    final fidelityRepo = context.watch<FidelityRepository>();
    final loyalty = fidelityRepo.clientLoyalty;
    final activeCarnets = fidelityRepo.clientPackages.where((p) => p.isActive).toList();

    return Scaffold(
      backgroundColor: AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Punto Cassa POS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: Column(
        children: [
          // 1. Cliente Selezionato
          Container(
            color: AppColors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                const CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.obsidianBlack,
                  child: Icon(Icons.person, color: AppColors.white, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_customerName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      Row(
                        children: [
                          Text(
                            'VIP Club: ${loyalty.pointsBalance} pt',
                            style: const TextStyle(fontSize: 11, color: AppColors.gold, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '(${loyalty.tierLabel})',
                            style: const TextStyle(fontSize: 11, color: AppColors.zinc400),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.add_shopping_cart, color: AppColors.zinc900),
                  onPressed: () => _showAddServiceSheet(services),
                ),
              ],
            ),
          ),

          const Divider(height: 1, color: AppColors.zinc200),

          // 2. Banner Carnet Attivo & Punti Fedeltà
          if (activeCarnets.isNotEmpty)
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.indigoLight,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.indigo.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.confirmation_number_outlined, color: AppColors.indigo, size: 22),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          activeCarnets.first.packageName,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.indigo),
                        ),
                        Text(
                          '${activeCarnets.first.remainingSessions} sedute disponibili per questo cliente',
                          style: TextStyle(fontSize: 10, color: AppColors.indigo.withOpacity(0.8)),
                        ),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    onPressed: () {
                      setState(() => _useCarnetSession = !_useCarnetSession);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _useCarnetSession ? AppColors.indigo : AppColors.white,
                      foregroundColor: _useCarnetSession ? AppColors.white : AppColors.indigo,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                    child: Text(
                      _useCarnetSession ? 'Seduta Applicata' : 'Usa 1 Seduta',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),

          // 3. Selezione Sconto Fedeltà (Pill -5€ / -10€)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                const Text('Riscatto Punti:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.zinc500)),
                const SizedBox(width: 8),
                _discountChip(5, 50, loyalty.pointsBalance),
                const SizedBox(width: 6),
                _discountChip(10, 100, loyalty.pointsBalance),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // 4. Carrello Voci di Cassa
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _cartItems.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final item = _cartItems[index];
                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.zinc200),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          Text(item.category, style: const TextStyle(fontSize: 10, color: AppColors.zinc400)),
                        ],
                      ),
                      Row(
                        children: [
                          Text('€${item.price.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline, color: AppColors.zinc400, size: 18),
                            onPressed: () => setState(() => _cartItems.removeAt(index)),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          ),

          // 5. Riepilogo Totale & Tasti Pagamento
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: AppColors.white,
              border: Border(top: BorderSide(color: AppColors.zinc200)),
            ),
            child: Column(
              children: [
                if (_carnetDeduction > 0)
                  _summaryRow('Scalato da Carnet:', '-€${_carnetDeduction.toStringAsFixed(2)}', AppColors.indigo),
                if (_loyaltyDiscount > 0)
                  _summaryRow('Sconto Punti Fedeltà:', '-€${_loyaltyDiscount.toStringAsFixed(2)}', AppColors.gold),
                _summaryRow('Punti che accumulerà:', '+$_pointsEarned pt', AppColors.emerald),
                const Divider(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.between,
                  children: [
                    const Text('TOTALE DA INCASSARE', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                    Text(
                      '€${_total.toStringAsFixed(2)}',
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.zinc900),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => _processCheckout('CONTANTI'),
                        icon: const Icon(Icons.payments_outlined, size: 18),
                        label: const Text('Contanti'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.zinc800,
                          foregroundColor: AppColors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => _processCheckout('CARTA_POS'),
                        icon: const Icon(Icons.credit_card, size: 18),
                        label: const Text('Carta / POS'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.obsidianBlack,
                          foregroundColor: AppColors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
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

  Widget _discountChip(int euros, int pointsRequired, int availablePoints) {
    final canRedeem = availablePoints >= pointsRequired;
    final isSelected = _loyaltyDiscount == euros;

    return GestureDetector(
      onTap: canRedeem
          ? () {
              setState(() {
                _loyaltyDiscount = isSelected ? 0 : euros;
              });
            }
          : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.gold : (canRedeem ? AppColors.white : AppColors.zinc100),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: canRedeem ? AppColors.gold : AppColors.zinc200),
        ),
        child: Text(
          '-€$euros ($pointsRequired pt)',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: isSelected ? AppColors.white : (canRedeem ? AppColors.gold : AppColors.zinc400),
          ),
        ),
      ),
    );
  }

  Widget _summaryRow(String label, String value, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.between,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.zinc500)),
          Text(value, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  void _showAddServiceSheet(List<SalonService> services) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Aggiungi Trattamento allo Scontrino', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 12),
            ...services.map((s) => ListTile(
                  title: Text(s.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                  trailing: Text('€${s.price.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                  onTap: () {
                    setState(() => _cartItems.add(s));
                    Navigator.pop(context);
                  },
                )),
          ],
        ),
      ),
    );
  }

  void _processCheckout(String method) {
    final fidelityRepo = context.read<FidelityRepository>();

    // 1. Scala seduta se applicata
    if (_useCarnetSession) {
      fidelityRepo.usePackageSession('cpkg-1');
    }

    // 2. Riscatta punti se usati
    if (_loyaltyDiscount > 0) {
      fidelityRepo.redeemPoints(_loyaltyDiscount * 10);
    }

    // 3. Accredita nuovi punti
    fidelityRepo.awardPoints(_pointsEarned);

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.receipt_long, size: 48, color: AppColors.emerald),
            const SizedBox(height: 12),
            const Text('Transazione Conclusa!', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 4),
            Text('Incasso registrato con $method.', style: const TextStyle(color: AppColors.zinc500, fontSize: 12)),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.zinc50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.zinc200),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      const Text('Importo Totale:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      Text('€${_total.toStringAsFixed(2)}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      const Text('Punti Accreditati:', style: TextStyle(fontSize: 12, color: AppColors.emerald)),
                      Text('+$_pointsEarned pt', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.emerald)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  setState(() {
                    _useCarnetSession = false;
                    _loyaltyDiscount = 0;
                  });
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.obsidianBlack,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Nuovo Scontrino', style: TextStyle(color: AppColors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
