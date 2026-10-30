import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_colors.dart';

class DailyCashClosingModal extends StatefulWidget {
  final String salonName;
  final DateTime date;
  final double totalRevenue;
  final double posRevenue;
  final double cashRevenue;
  final int totalReceipts;

  const DailyCashClosingModal({
    super.key,
    required this.salonName,
    required this.date,
    this.totalRevenue = 580.0,
    this.posRevenue = 410.0,
    this.cashRevenue = 170.0,
    this.totalReceipts = 14,
  });

  static Future<void> show(
    BuildContext context, {
    required String salonName,
    required DateTime date,
    double totalRevenue = 580.0,
    double posRevenue = 410.0,
    double cashRevenue = 170.0,
    int totalReceipts = 14,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DailyCashClosingModal(
        salonName: salonName,
        date: date,
        totalRevenue: totalRevenue,
        posRevenue: posRevenue,
        cashRevenue: cashRevenue,
        totalReceipts: totalReceipts,
      ),
    );
  }

  @override
  State<DailyCashClosingModal> createState() => _DailyCashClosingModalState();
}

class _DailyCashClosingModalState extends State<DailyCashClosingModal> {
  final TextEditingController _floatCashCtrl = TextEditingController(text: '150.00');
  final TextEditingController _notesCtrl = TextEditingController();
  String _closedBy = 'Titolare (Marco)';
  bool _isSealed = false;
  DateTime? _sealedAt;

  @override
  void dispose() {
    _floatCashCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final floatCash = double.tryParse(_floatCashCtrl.text) ?? 150.0;
    final totalDrawerCash = floatCash + widget.cashRevenue;
    final avgTicket = widget.totalReceipts > 0 ? (widget.totalRevenue / widget.totalReceipts) : 0.0;

    return Container(
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
      child: SingleChildScrollView(
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
                            'REPORT Z SIGILLATO CON SUCCESSO',
                            style: TextStyle(color: AppColors.emerald, fontWeight: FontWeight.w900, fontSize: 12),
                          ),
                          Text(
                            'Trasmesso all\'Agenzia delle Entrate e registrato su Cloud alle ${DateFormat('HH:mm:ss').format(_sealedAt ?? DateTime.now())}',
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

            // 1. Griglia KPI Totali
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.obsidianBlack,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'INCASSO TOTALE',
                          style: TextStyle(color: AppColors.zinc400, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '€ ${widget.totalRevenue.toStringAsFixed(2)}',
                          style: const TextStyle(color: AppColors.white, fontSize: 22, fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${widget.totalReceipts} scontrini • Media € ${avgTicket.toStringAsFixed(1)}',
                          style: const TextStyle(color: AppColors.gold, fontSize: 11, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // 2. Suddivisione POS vs Contanti
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
                            Text('POS / Elettronico', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.zinc600)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '€ ${widget.posRevenue.toStringAsFixed(2)}',
                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: AppColors.zinc900),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
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
                            Text('Contanti in Cassa', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.zinc600)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '€ ${widget.cashRevenue.toStringAsFixed(2)}',
                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: AppColors.zinc900),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // 3. Fondo Cassa & Conteggio Cassetto
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.zinc50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.zinc200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Fondo Cassa & Riconciliazione Cassetto', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Fondo cassa iniziale:',
                          style: TextStyle(fontSize: 12, color: AppColors.zinc600),
                        ),
                      ),
                      SizedBox(
                        width: 90,
                        height: 36,
                        child: TextField(
                          controller: _floatCashCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          onChanged: (_) => setState(() {}),
                          textAlign: TextAlign.end,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          decoration: InputDecoration(
                            prefixText: '€ ',
                            contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Totale contanti da trovare nel cassetto:',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.zinc800),
                      ),
                      Text(
                        '€ ${totalDrawerCash.toStringAsFixed(2)}',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: AppColors.emerald),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 4. Operatore e Note
            DropdownButtonFormField<String>(
              value: _closedBy,
              decoration: InputDecoration(
                labelText: 'Operatore Responsabile Chiusura',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              ),
              items: const [
                DropdownMenuItem(value: 'Titolare (Marco)', child: Text('Titolare (Marco)')),
                DropdownMenuItem(value: 'Elena (Colorist)', child: Text('Elena (Colorist)')),
                DropdownMenuItem(value: 'Luca (Barber)', child: Text('Luca (Barber)')),
              ],
              onChanged: (val) => setState(() => _closedBy = val ?? _closedBy),
            ),

            const SizedBox(height: 12),

            TextField(
              controller: _notesCtrl,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: 'Note o anomalie di cassa (opzionale)',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              ),
            ),

            const SizedBox(height: 20),

            // 5. Pulsante Sigilla Chiusura Cassa
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                onPressed: _isSealed
                    ? () => Navigator.pop(context)
                    : () {
                        setState(() {
                          _isSealed = true;
                          _sealedAt = DateTime.now();
                        });
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Chiusura Cassa Fiscale (Report Z) sigillata con successo!'),
                            backgroundColor: AppColors.emerald,
                          ),
                        );
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: _isSealed ? AppColors.emerald : AppColors.obsidianBlack,
                  foregroundColor: AppColors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                icon: Icon(_isSealed ? Icons.check : Icons.lock_outline, size: 20),
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
