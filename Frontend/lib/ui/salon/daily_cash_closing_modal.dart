import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/receipt_model.dart';
import '../../data/repositories/checkout_repository.dart';
import '../../data/repositories/auth_repository.dart';

class DailyCashClosingModal extends StatefulWidget {
  final String salonName;
  final DateTime date;

  const DailyCashClosingModal({
    super.key,
    required this.salonName,
    required this.date,
  });

  static Future<void> show(
    BuildContext context, {
    required String salonName,
    required DateTime date,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DailyCashClosingModal(
        salonName: salonName,
        date: date,
      ),
    );
  }

  @override
  State<DailyCashClosingModal> createState() => _DailyCashClosingModalState();
}

class _DailyCashClosingModalState extends State<DailyCashClosingModal> {
  final TextEditingController _floatCashCtrl = TextEditingController(text: '150.00');
  final TextEditingController _actualCashCtrl = TextEditingController();
  final TextEditingController _notesCtrl = TextEditingController();
  String _closedBy = 'Titolare Salone';
  bool _isSealed = false;
  DateTime? _sealedAt;
  bool _isLoadingInitial = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkExistingClosing();
    });
  }

  Future<void> _checkExistingClosing() async {
    final checkoutRepo = context.read<CheckoutRepository>();
    final existing = await checkoutRepo.getSavedDailyClosing(widget.date);
    if (existing != null && mounted) {
      setState(() {
        _isSealed = existing.isSealed;
        _sealedAt = existing.closedAt;
        _closedBy = existing.closedBy;
        _floatCashCtrl.text = existing.initialDrawerCash.toStringAsFixed(2);
        _actualCashCtrl.text = existing.actualCashCounted.toStringAsFixed(2);
        if (existing.notes != null) _notesCtrl.text = existing.notes!;
        _isLoadingInitial = false;
      });
    } else if (mounted) {
      setState(() => _isLoadingInitial = false);
    }
  }

  @override
  void dispose() {
    _floatCashCtrl.dispose();
    _actualCashCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final checkoutRepo = context.watch<CheckoutRepository>();
    final authRepo = context.read<AuthRepository>();
    final salonId = authRepo.currentUser?.salonId ?? authRepo.currentUser?.uid ?? 'salone_default';

    checkoutRepo.setSalon(salonId);

    final receipts = checkoutRepo.getReceiptsForDate(widget.date);

    // Calcolo dinamico valori reali
    final double totalRevenue = receipts.fold(0.0, (acc, r) => acc + r.finalAmount);
    final double cashRevenue = receipts.fold(0.0, (acc, r) {
      if (r.paymentMethod == 'CONTANTI' || r.paymentMethod == 'CASH') return acc + r.finalAmount;
      if (r.paymentMethod == 'MISTO' || r.paymentMethod == 'MIXED') return acc + (r.cashAmount ?? 0.0);
      return acc;
    });
    final double posRevenue = receipts.fold(0.0, (acc, r) {
      if (r.paymentMethod == 'CARTA_POS' || r.paymentMethod == 'CARD') return acc + r.finalAmount;
      if (r.paymentMethod == 'MISTO' || r.paymentMethod == 'MIXED') return acc + (r.cardAmount ?? 0.0);
      return acc;
    });
    final double satispayRevenue = receipts.fold(0.0, (acc, r) {
      if (r.paymentMethod == 'SATISPAY') return acc + r.finalAmount;
      return acc;
    });
    final double totalVat = receipts.fold(0.0, (acc, r) => acc + r.vatAmount);
    final int totalReceipts = receipts.length;
    final double avgTicket = totalReceipts > 0 ? (totalRevenue / totalReceipts) : 0.0;

    final floatCash = double.tryParse(_floatCashCtrl.text) ?? 150.0;
    final totalExpectedDrawerCash = floatCash + cashRevenue;

    final actualCounted = double.tryParse(_actualCashCtrl.text) ?? totalExpectedDrawerCash;
    final cashDiff = actualCounted - totalExpectedDrawerCash;

    final isDiffZero = cashDiff.abs() < 0.01;

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.9),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: _isLoadingInitial
          ? const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()))
          : SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Barra di trascinamento
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.zinc300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Intestazione
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFFBEB),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.gold.withOpacity(0.3)),
                        ),
                        child: const Icon(Icons.point_of_sale, color: AppColors.gold, size: 24),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Text(
                                  'Chiusura Fiscale Cassa',
                                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: AppColors.zinc900),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.obsidianBlack,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    'REPORT Z',
                                    style: TextStyle(color: AppColors.white, fontSize: 9, fontWeight: FontWeight.bold),
                                  ),
                                ),
                              ],
                            ),
                            Text(
                              '${widget.salonName} • ${DateFormat('EEEE d MMMM yyyy', 'it_IT').format(widget.date)}',
                              style: const TextStyle(fontSize: 12, color: AppColors.zinc500),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close, color: AppColors.zinc400),
                      ),
                    ],
                  ),

                  const SizedBox(height: 18),

                  if (_isSealed) ...[
                    // Banner Sigillato con Successo
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.emeraldLight,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.emerald.withOpacity(0.4)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.check_circle, color: AppColors.emerald, size: 28),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'REPORT Z SIGILLATO & SINCRONIZZATO',
                                  style: TextStyle(color: AppColors.emerald, fontWeight: FontWeight.w900, fontSize: 12),
                                ),
                                Text(
                                  'Trasmesso all\'Agenzia delle Entrate e salvato nel Cloud Firestore alle ${DateFormat('HH:mm:ss').format(_sealedAt ?? DateTime.now())}',
                                  style: const TextStyle(color: AppColors.zinc700, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // 1. Griglia KPI Totali Reali
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.obsidianBlack,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'INCASSO TOTALE REALE',
                              style: TextStyle(color: AppColors.zinc400, fontSize: 10, fontWeight: FontWeight.bold),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppColors.zinc800,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                '$totalReceipts Scontrini',
                                style: const TextStyle(color: AppColors.white, fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '€ ${totalRevenue.toStringAsFixed(2)}',
                          style: const TextStyle(color: AppColors.white, fontSize: 26, fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Scontrino Medio: € ${avgTicket.toStringAsFixed(2)}',
                              style: const TextStyle(color: AppColors.gold, fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                            Text(
                              'IVA 22% a debito: € ${totalVat.toStringAsFixed(2)}',
                              style: const TextStyle(color: AppColors.zinc400, fontSize: 11),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // 2. Suddivisione per metodo di pagamento reale
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.zinc50,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AppColors.zinc200),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Row(
                                children: [
                                  Icon(Icons.credit_card, size: 14, color: AppColors.indigo),
                                  SizedBox(width: 6),
                                  Text('POS / Carta', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.zinc600)),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '€ ${posRevenue.toStringAsFixed(2)}',
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.zinc900),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.zinc50,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AppColors.zinc200),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Row(
                                children: [
                                  Icon(Icons.payments_outlined, size: 14, color: AppColors.emerald),
                                  SizedBox(width: 6),
                                  Text('Contanti', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.zinc600)),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '€ ${cashRevenue.toStringAsFixed(2)}',
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.zinc900),
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (satispayRevenue > 0) ...[
                        const SizedBox(width: 8),
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.zinc50,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: AppColors.zinc200),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Row(
                                  children: [
                                    Icon(Icons.qr_code, size: 14, color: AppColors.gold),
                                    SizedBox(width: 6),
                                    Text('Satispay', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.zinc600)),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  '€ ${satispayRevenue.toStringAsFixed(2)}',
                                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.zinc900),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),

                  const SizedBox(height: 16),

                  // 3. Fondo Cassa & Riconciliazione Cassetto
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.zinc50,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.zinc200),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.account_balance_wallet, size: 16, color: AppColors.zinc700),
                            SizedBox(width: 8),
                            Text('Quadratura Cassetto Contanti', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Fondo cassa iniziale del mattino:',
                                style: TextStyle(fontSize: 12, color: AppColors.zinc600),
                              ),
                            ),
                            SizedBox(
                              width: 95,
                              height: 38,
                              child: TextField(
                                controller: _floatCashCtrl,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                onChanged: (_) => setState(() {}),
                                enabled: !_isSealed,
                                textAlign: TextAlign.end,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                decoration: InputDecoration(
                                  prefixText: '€ ',
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'Totale contanti teorico atteso in cassa:',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.zinc800),
                            ),
                            Text(
                              '€ ${totalExpectedDrawerCash.toStringAsFixed(2)}',
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.zinc900),
                            ),
                          ],
                        ),
                        const Divider(height: 16),
                        Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Contanti effettivi contati alla chiusura:',
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.zinc800),
                              ),
                            ),
                            SizedBox(
                              width: 95,
                              height: 38,
                              child: TextField(
                                controller: _actualCashCtrl,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                onChanged: (_) => setState(() {}),
                                enabled: !_isSealed,
                                textAlign: TextAlign.end,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                decoration: InputDecoration(
                                  hintText: totalExpectedDrawerCash.toStringAsFixed(2),
                                  prefixText: '€ ',
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Differenza di cassa:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: isDiffZero
                                    ? AppColors.emeraldLight
                                    : (cashDiff > 0 ? const Color(0xFFEFF6FF) : const Color(0xFFFEF2F2)),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                isDiffZero ? 'Perfetta (0.00 €)' : '${cashDiff >= 0 ? "+" : ""}€ ${cashDiff.toStringAsFixed(2)}',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: isDiffZero
                                      ? AppColors.emerald
                                      : (cashDiff > 0 ? AppColors.indigo : AppColors.rose),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // 4. Storico scontrini compresi in questa chiusura
                  const Text('Scontrini Inclusi nel Report Z', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  const SizedBox(height: 8),
                  if (receipts.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.zinc100,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Center(
                        child: Text(
                          'Nessuno scontrino emesso per questa data.\nEmetti il primo scontrino dal POS.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 12, color: AppColors.zinc500),
                        ),
                      ),
                    )
                  else
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.zinc50,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.zinc200),
                      ),
                      child: ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: receipts.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (ctx, i) {
                          final r = receipts[i];
                          return ListTile(
                            dense: true,
                            leading: CircleAvatar(
                              radius: 14,
                              backgroundColor: r.paymentMethod == 'CASH' || r.paymentMethod == 'CONTANTI'
                                  ? AppColors.emeraldLight
                                  : AppColors.indigoLight,
                              child: Icon(
                                r.paymentMethod == 'CASH' || r.paymentMethod == 'CONTANTI'
                                    ? Icons.payments_outlined
                                    : Icons.credit_card,
                                size: 14,
                                color: r.paymentMethod == 'CASH' || r.paymentMethod == 'CONTANTI'
                                    ? AppColors.emerald
                                    : AppColors.indigo,
                              ),
                            ),
                            title: Text(
                              '${r.receiptNumber} • ${r.customerName}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                            subtitle: Text(
                              '${DateFormat('HH:mm').format(r.issuedAt)} • ${r.items.length} voci • Operatore: ${r.operatorName}',
                              style: const TextStyle(fontSize: 10, color: AppColors.zinc500),
                            ),
                            trailing: Text(
                              '€${r.finalAmount.toStringAsFixed(2)}',
                              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
                            ),
                          );
                        },
                      ),
                    ),

                  const SizedBox(height: 16),

                  // 5. Responsabile Chiusura & Note
                  TextField(
                    enabled: !_isSealed,
                    controller: TextEditingController(text: _closedBy),
                    onChanged: (v) => _closedBy = v,
                    decoration: InputDecoration(
                      labelText: 'Responsabile Sigillo Fiscale',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                  ),

                  const SizedBox(height: 10),

                  TextField(
                    enabled: !_isSealed,
                    controller: _notesCtrl,
                    maxLines: 2,
                    decoration: InputDecoration(
                      labelText: 'Note o anomalie di cassa (opzionale)',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // 6. Pulsante Sigilla Chiusura Cassa
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton.icon(
                      onPressed: () async {
                        if (_isSealed) {
                          Navigator.pop(context);
                          return;
                        }

                        final closing = checkoutRepo.calculateDailyClosing(
                          widget.date,
                          initialDrawerCash: floatCash,
                          actualCashCounted: actualCounted,
                          closedBy: _closedBy,
                          notes: _notesCtrl.text.isNotEmpty ? _notesCtrl.text : null,
                        );

                        await checkoutRepo.saveDailyClosing(closing);

                        setState(() {
                          _isSealed = true;
                          _sealedAt = DateTime.now();
                        });

                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('✅ Chiusura Fiscale Cassa (Report Z) sigillata e sincronizzata su Google Cloud Firestore!'),
                              backgroundColor: AppColors.emerald,
                            ),
                          );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _isSealed ? AppColors.emerald : AppColors.obsidianBlack,
                        foregroundColor: AppColors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                      icon: Icon(_isSealed ? Icons.check_circle : Icons.lock_outline, size: 20),
                      label: Text(
                        _isSealed ? 'Chiudi Schermata' : 'Sigilla Chiusura Cassa (Report Z)',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
