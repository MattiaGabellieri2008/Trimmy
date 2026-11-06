import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/service_model.dart';
import '../../data/models/product_model.dart';
import '../../data/models/receipt_model.dart';
import '../../data/repositories/salon_repository.dart';
import '../../data/repositories/fidelity_repository.dart';
import '../../data/repositories/inventory_repository.dart';
import '../../data/repositories/checkout_repository.dart';
import '../../data/repositories/auth_repository.dart';
import 'daily_cash_closing_modal.dart';

class PosCheckoutScreen extends StatefulWidget {
  final String? initialAppointmentId;
  final String? initialCustomerName;
  final String? initialServiceId;

  const PosCheckoutScreen({
    super.key,
    this.initialAppointmentId,
    this.initialCustomerName,
    this.initialServiceId,
  });

  @override
  State<PosCheckoutScreen> createState() => _PosCheckoutScreenState();
}

class _PosCheckoutScreenState extends State<PosCheckoutScreen> {
  final List<ReceiptItem> _cartItems = [];
  bool _useCarnetSession = false;
  int _loyaltyDiscount = 0; // Euro di sconto riscattati (es. 5, 10)
  double _manualDiscount = 0.0; // Sconto manuale facoltativo in euro

  // Cliente selezionato
  String _customerName = 'Cliente Occasionale / Al Banco';
  String? _customerId;
  String? _customerPhone;
  int _customerPoints = 0;
  String _customerTier = 'Base';

  // Operatore cassa
  String _operatorName = 'Staff Cassa';

  @override
  void initState() {
    super.initState();
    if (widget.initialCustomerName != null && widget.initialCustomerName!.isNotEmpty) {
      _customerName = widget.initialCustomerName!;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authRepo = context.read<AuthRepository>();
      final salonId = authRepo.currentUser?.salonId ?? authRepo.currentUser?.uid ?? 'salone_default';
      context.read<CheckoutRepository>().setSalon(salonId);
      context.read<InventoryRepository>().setSalon(salonId);

      _operatorName = authRepo.currentUser?.displayName ?? 'Staff Cassa';

      // Se non ci sono voci, carica il primo servizio dal catalogo come default per iniziare subito
      if (_cartItems.isEmpty) {
        final services = context.read<SalonRepository>().services;
        if (services.isNotEmpty) {
          SalonService initialService = services.first;
          if (widget.initialServiceId != null) {
            final found = services.where((s) => s.id == widget.initialServiceId).firstOrNull;
            if (found != null) initialService = found;
          }
          setState(() {
            _cartItems.add(ReceiptItem(
              id: initialService.id,
              type: 'SERVICE',
              name: initialService.name,
              price: initialService.price,
              quantity: 1,
              operatorName: _operatorName,
            ));
          });
        }
      }
    });
  }

  double get _subtotal => _cartItems.fold(0.0, (acc, item) => acc + item.totalPrice);
  double get _carnetDeduction => _useCarnetSession ? (_cartItems.isNotEmpty ? _cartItems.first.price : 0.0) : 0.0;
  double get _totalDiscount => _carnetDeduction + _loyaltyDiscount + _manualDiscount;
  double get _total => (_subtotal - _totalDiscount).clamp(0.0, 99999.0);
  int get _pointsEarned => (_total * 0.10).floor();

  double get _netAmount => _total / 1.22;
  double get _vatAmount => _total - _netAmount;

  @override
  Widget build(BuildContext context) {
    final services = context.watch<SalonRepository>().services;
    final inventory = context.watch<InventoryRepository>().products;
    final fidelityRepo = context.watch<FidelityRepository>();
    final activeCarnets = fidelityRepo.clientPackages.where((p) => p.isActive).toList();
    final authRepo = context.watch<AuthRepository>();
    final salonName = authRepo.currentUser?.salonName ?? 'Trimmy Salone';

    return Scaffold(
      backgroundColor: AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Punto Cassa POS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: AppColors.white,
        elevation: 0,
        actions: [
          // 1. Tasto Storico Scontrini di oggi
          IconButton(
            tooltip: 'Storico Scontrini Oggi',
            icon: const Icon(Icons.receipt_long, color: AppColors.zinc800),
            onPressed: () => _showTodayReceiptsModal(),
          ),
          // 2. Tasto Rapido Chiusura Fiscale Cassa (Report Z)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: TextButton.icon(
              onPressed: () {
                DailyCashClosingModal.show(
                  context,
                  salonName: salonName,
                  date: DateTime.now(),
                );
              },
              icon: const Icon(Icons.lock_clock, size: 16, color: AppColors.obsidianBlack),
              label: const Text('Chiusura Z', style: TextStyle(color: AppColors.obsidianBlack, fontWeight: FontWeight.bold, fontSize: 12)),
              style: TextButton.styleFrom(
                backgroundColor: AppColors.zinc100,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // 1. Barra Cliente & Operatore Cassa
          _buildClientAndOperatorHeader(),

          const Divider(height: 1, color: AppColors.zinc200),

          // 2. Banner Carnet Attivo (se presente)
          if (activeCarnets.isNotEmpty && _customerId != null)
            _buildCarnetBanner(activeCarnets.first),

          // 3. Riscatto Punti Fedeltà VIP (se cliente selezionato)
          if (_customerPoints > 0)
            _buildFidelityPills(),

          const SizedBox(height: 8),

          // 4. Lista Carrello Voci Scontrino
          Expanded(
            child: _cartItems.isEmpty
                ? _buildEmptyCart()
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: _cartItems.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) => _buildCartItemCard(index),
                  ),
          ),

          // 5. Pulsante Rapido Aggiunta Servizio o Prodotto
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: SizedBox(
              width: double.infinity,
              height: 42,
              child: OutlinedButton.icon(
                onPressed: () => _showAddItemSheet(services, inventory),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Aggiungi Servizio o Prodotto', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.zinc900,
                  side: const BorderSide(color: AppColors.zinc300, width: 1.5),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  backgroundColor: AppColors.white,
                ),
              ),
            ),
          ),

          // 6. Riepilogo Fiscale & Pulsanti Incasso
          _buildFiscalSummaryAndPaymentSection(),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // WIDGET COMPONENTI UI
  // --------------------------------------------------------------------------

  Widget _buildClientAndOperatorHeader() {
    return Container(
      color: AppColors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          GestureDetector(
            onTap: _showClientSelectionSheet,
            child: CircleAvatar(
              radius: 19,
              backgroundColor: _customerId != null ? AppColors.obsidianBlack : AppColors.zinc300,
              child: Icon(
                _customerId != null ? Icons.person : Icons.person_outline,
                color: AppColors.white,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: InkWell(
              onTap: _showClientSelectionSheet,
              borderRadius: BorderRadius.circular(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          _customerName,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.arrow_drop_down, size: 18, color: AppColors.zinc500),
                    ],
                  ),
                  if (_customerPoints > 0)
                    Row(
                      children: [
                        Text(
                          'VIP Club: $_customerPoints pt',
                          style: const TextStyle(fontSize: 11, color: AppColors.gold, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(width: 6),
                        Text('($_customerTier)', style: const TextStyle(fontSize: 11, color: AppColors.zinc400)),
                      ],
                    )
                  else
                    const Text('Tocca per assegnare cliente da CRM', style: TextStyle(fontSize: 10, color: AppColors.zinc400)),
                ],
              ),
            ),
          ),
          // Selettore Operatore Cassa
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.zinc100,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.zinc200),
            ),
            child: Row(
              children: [
                const Icon(Icons.badge_outlined, size: 14, color: AppColors.zinc600),
                const SizedBox(width: 4),
                Text(
                  _operatorName,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.zinc800),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCarnetBanner(dynamic carnet) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.indigoLight,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.indigo.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.confirmation_number_outlined, color: AppColors.indigo, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  carnet.packageName,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.indigo),
                ),
                Text(
                  '${carnet.remainingSessions} sedute disponibili nel carnet del cliente',
                  style: TextStyle(fontSize: 10, color: AppColors.indigo.withOpacity(0.85)),
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
    );
  }

  Widget _buildFidelityPills() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        children: [
          const Text('Riscatto VIP:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.zinc500)),
          const SizedBox(width: 8),
          _discountChip(5, 50, _customerPoints),
          const SizedBox(width: 6),
          _discountChip(10, 100, _customerPoints),
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.gold : (canRedeem ? AppColors.white : AppColors.zinc100),
          borderRadius: BorderRadius.circular(8),
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

  Widget _buildEmptyCart() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppColors.zinc100,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.point_of_sale, size: 38, color: AppColors.zinc400),
          ),
          const SizedBox(height: 12),
          const Text(
            'Carrello Cassa Vuoto',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.zinc700),
          ),
          const SizedBox(height: 4),
          const Text(
            'Aggiungi i trattamenti eseguiti o i prodotti venduti',
            style: TextStyle(fontSize: 12, color: AppColors.zinc400),
          ),
        ],
      ),
    );
  }

  Widget _buildCartItemCard(int index) {
    final item = _cartItems[index];
    final isService = item.type == 'SERVICE';
    final isProduct = item.type == 'PRODUCT';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.zinc200),
      ),
      child: Row(
        children: [
          // Icona tipologia
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isService ? AppColors.indigoLight : (isProduct ? AppColors.emeraldLight : AppColors.zinc100),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              isService ? Icons.content_cut : (isProduct ? Icons.sanitizer_outlined : Icons.label_outline),
              size: 18,
              color: isService ? AppColors.indigo : (isProduct ? AppColors.emerald : AppColors.zinc700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: AppColors.zinc100,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        isService ? 'Trattamento' : (isProduct ? 'Prodotto' : 'Voce libera'),
                        style: const TextStyle(fontSize: 9, color: AppColors.zinc600, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '€${item.price.toStringAsFixed(2)} cad. (IVA 22% incl.)',
                      style: const TextStyle(fontSize: 10, color: AppColors.zinc500),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Stepper Quantità
          Container(
            decoration: BoxDecoration(
              color: AppColors.zinc100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                InkWell(
                  onTap: () {
                    setState(() {
                      if (item.quantity > 1) {
                        item.quantity--;
                      } else {
                        _cartItems.removeAt(index);
                      }
                    });
                  },
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    child: Icon(Icons.remove, size: 14, color: AppColors.zinc700),
                  ),
                ),
                Text(
                  '${item.quantity}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                ),
                InkWell(
                  onTap: () {
                    setState(() => item.quantity++);
                  },
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    child: Icon(Icons.add, size: 14, color: AppColors.zinc700),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),

          // Totale riga
          Text(
            '€${item.totalPrice.toStringAsFixed(2)}',
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildFiscalSummaryAndPaymentSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Color(0x0D000000),
            blurRadius: 10,
            offset: Offset(0, -3),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Dettagli scorporo fiscale
          if (_carnetDeduction > 0)
            _summaryRow('Scalato da Carnet:', '-€${_carnetDeduction.toStringAsFixed(2)}', AppColors.indigo),
          if (_loyaltyDiscount > 0)
            _summaryRow('Sconto Punti Fedeltà:', '-€${_loyaltyDiscount.toStringAsFixed(2)}', AppColors.gold),
          if (_manualDiscount > 0)
            _summaryRow('Sconto Manuale:', '-€${_manualDiscount.toStringAsFixed(2)}', AppColors.rose),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Imponibile: €${_netAmount.toStringAsFixed(2)}  •  IVA 22%: €${_vatAmount.toStringAsFixed(2)}',
                style: const TextStyle(fontSize: 10, color: AppColors.zinc400),
              ),
              Text(
                '+$_pointsEarned pt VIP',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.emerald),
              ),
            ],
          ),

          const Divider(height: 14),

          // Riga Grande Totale
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('TOTALE SCONTRINO', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: AppColors.zinc900)),
                  Text('Documento commerciale online', style: TextStyle(fontSize: 10, color: AppColors.zinc400)),
                ],
              ),
              Text(
                '€${_total.toStringAsFixed(2)}',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.zinc900),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Tasti Pagamento Fiscale
          Row(
            children: [
              // 1. Contanti
              Expanded(
                flex: 4,
                child: ElevatedButton.icon(
                  onPressed: _cartItems.isEmpty ? null : () => _showCashPaymentDialog(),
                  icon: const Icon(Icons.payments_outlined, size: 18),
                  label: const Text('Contanti', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.zinc800,
                    foregroundColor: AppColors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // 2. Carta / POS
              Expanded(
                flex: 4,
                child: ElevatedButton.icon(
                  onPressed: _cartItems.isEmpty ? null : () => _confirmPaymentAndEmit('CARTA_POS'),
                  icon: const Icon(Icons.credit_card, size: 18),
                  label: const Text('Carta / POS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.obsidianBlack,
                    foregroundColor: AppColors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // 3. Altro / Misto
              Container(
                decoration: BoxDecoration(
                  color: AppColors.zinc100,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.zinc300),
                ),
                child: PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert, color: AppColors.zinc800, size: 20),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  onSelected: (val) {
                    if (val == 'SATISPAY') {
                      _confirmPaymentAndEmit('SATISPAY');
                    } else if (val == 'MISTO') {
                      _showMixedPaymentDialog();
                    } else if (val == 'DISCOUNT') {
                      _showManualDiscountDialog();
                    }
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(
                      value: 'SATISPAY',
                      child: Row(children: [Icon(Icons.qr_code, size: 18, color: AppColors.rose), SizedBox(width: 8), Text('Satispay / Digitale')]),
                    ),
                    const PopupMenuItem(
                      value: 'MISTO',
                      child: Row(children: [Icon(Icons.call_split, size: 18, color: AppColors.indigo), SizedBox(width: 8), Text('Pagamento Misto (Contanti + Carta)')]),
                    ),
                    const PopupMenuItem(
                      value: 'DISCOUNT',
                      child: Row(children: [Icon(Icons.discount_outlined, size: 18, color: AppColors.gold), SizedBox(width: 8), Text('Applica Sconto Manuale')]),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryRow(String label, String value, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.zinc500)),
          Text(value, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // MODALI AGGIUNTA ARTICOLI (SERVIZI, PRODOTTI, VOCE LIBERA)
  // --------------------------------------------------------------------------

  void _showAddItemSheet(List<SalonService> services, List<ProductModel> products) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _AddItemModal(
        services: services,
        products: products,
        operatorName: _operatorName,
        onAdd: (item) {
          setState(() {
            // Se esiste già lo stesso elemento, incrementa la quantità
            final existing = _cartItems.where((i) => i.id == item.id && i.type == item.type).firstOrNull;
            if (existing != null) {
              existing.quantity += item.quantity;
            } else {
              _cartItems.add(item);
            }
          });
        },
      ),
    );
  }

  // --------------------------------------------------------------------------
  // SELEZIONE CLIENTE DA CRM / ANAGRAFICA
  // --------------------------------------------------------------------------

  void _showClientSelectionSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => _ClientSelectorSheet(
        currentClientId: _customerId,
        onClientSelected: (name, phone, id, points, tier) {
          setState(() {
            _customerName = name;
            _customerPhone = phone;
            _customerId = id;
            _customerPoints = points;
            _customerTier = tier;
            _loyaltyDiscount = 0;
            _useCarnetSession = false;
          });
        },
      ),
    );
  }

  // --------------------------------------------------------------------------
  // GESTIONE PAGAMENTI E CONTANTI
  // --------------------------------------------------------------------------

  void _showCashPaymentDialog() {
    double cashReceived = _total;
    final totalRoundedCeil = (_total / 10).ceil() * 10.0;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          final change = (cashReceived - _total).clamp(0.0, 9999.0);

          return Container(
            padding: EdgeInsets.only(
              top: 20,
              left: 20,
              right: 20,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
            ),
            decoration: const BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(color: AppColors.zinc300, borderRadius: BorderRadius.circular(2)),
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Pagamento in Contanti & Resto', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
                const SizedBox(height: 4),
                Text('Totale da riscuotere: €${_total.toStringAsFixed(2)}', style: const TextStyle(color: AppColors.zinc500, fontSize: 13)),
                const SizedBox(height: 16),

                // Tasti rapidi banconote
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _quickCashChip('Esatto', _total, cashReceived, (v) => setModalState(() => cashReceived = v)),
                      _quickCashChip('€20', 20.0, cashReceived, (v) => setModalState(() => cashReceived = v)),
                      _quickCashChip('€50', 50.0, cashReceived, (v) => setModalState(() => cashReceived = v)),
                      _quickCashChip('€100', 100.0, cashReceived, (v) => setModalState(() => cashReceived = v)),
                      if (totalRoundedCeil > _total && totalRoundedCeil != 50 && totalRoundedCeil != 100)
                        _quickCashChip('€${totalRoundedCeil.toInt()}', totalRoundedCeil, cashReceived, (v) => setModalState(() => cashReceived = v)),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // Box Calcolo Resto
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.zinc50,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.zinc200),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Contanti Ricevuti:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                          Text('€${cashReceived.toStringAsFixed(2)}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                        ],
                      ),
                      const Divider(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('RESTO DA DARE:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: AppColors.emerald)),
                          Text(
                            '€${change.toStringAsFixed(2)}',
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.emerald),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: cashReceived < _total
                        ? null
                        : () {
                            Navigator.pop(ctx);
                            _confirmPaymentAndEmit(
                              'CONTANTI',
                              cashGiven: cashReceived,
                              changeGiven: change,
                            );
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.obsidianBlack,
                      foregroundColor: AppColors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Emetti Scontrino Fiscale', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _quickCashChip(String label, double amount, double current, Function(double) onSelect) {
    final isSelected = (current - amount).abs() < 0.01;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: isSelected ? AppColors.white : AppColors.zinc800)),
        selected: isSelected,
        selectedColor: AppColors.obsidianBlack,
        backgroundColor: AppColors.zinc100,
        onSelected: (_) => onSelect(amount),
      ),
    );
  }

  void _showMixedPaymentDialog() {
    double cashPortion = (_total / 2).roundToDouble();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Pagamento Misto', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Dividi l\'importo tra Contanti e Carta POS:', style: TextStyle(fontSize: 12, color: AppColors.zinc600)),
            const SizedBox(height: 12),
            TextField(
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Quota Contanti (€)', border: OutlineInputBorder()),
              controller: TextEditingController(text: cashPortion.toStringAsFixed(2)),
              onChanged: (val) {
                cashPortion = double.tryParse(val) ?? 0.0;
              },
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annulla')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              final safeCash = cashPortion.clamp(0.0, _total);
              final safeCard = (_total - safeCash).clamp(0.0, _total);
              _confirmPaymentAndEmit('MISTO', cashAmount: safeCash, cardAmount: safeCard);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.obsidianBlack),
            child: const Text('Conferma Misto', style: TextStyle(color: AppColors.white)),
          ),
        ],
      ),
    );
  }

  void _showManualDiscountDialog() {
    double discount = 5.0;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Applica Sconto Manuale', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: TextField(
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Euro di Sconto (€)', prefixText: '€ ', border: OutlineInputBorder()),
          controller: TextEditingController(text: discount.toStringAsFixed(0)),
          onChanged: (v) => discount = double.tryParse(v) ?? 0.0,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annulla')),
          ElevatedButton(
            onPressed: () {
              setState(() => _manualDiscount = discount);
              Navigator.pop(ctx);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.obsidianBlack),
            child: const Text('Applica Sconto', style: TextStyle(color: AppColors.white)),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // EMISSIONE SCONTRINO FISCALE & SINCRONIZZAZIONE FIRESTORE
  // --------------------------------------------------------------------------

  Future<void> _confirmPaymentAndEmit(
    String method, {
    double? cashGiven,
    double? changeGiven,
    double? cashAmount,
    double? cardAmount,
  }) async {
    final checkoutRepo = context.read<CheckoutRepository>();
    final inventoryRepo = context.read<InventoryRepository>();
    final fidelityRepo = context.read<FidelityRepository>();
    final authRepo = context.read<AuthRepository>();
    final salonId = authRepo.currentUser?.salonId ?? authRepo.currentUser?.uid ?? 'salone_default';
    final salonName = authRepo.currentUser?.salonName ?? 'Trimmy Salone';

    final now = DateTime.now();
    final receiptNumber = checkoutRepo.getNextReceiptNumber(now);
    final txId = 'tx_${now.millisecondsSinceEpoch}_${Random().nextInt(9999)}';
    final rtCode = 'RT-${Random().nextInt(89999) + 10000}-TELEMATICO';

    final receipt = ReceiptModel(
      id: txId,
      tenantId: salonId,
      receiptNumber: receiptNumber,
      issuedAt: now,
      customerId: _customerId,
      customerName: _customerName,
      customerPhone: _customerPhone,
      operatorName: _operatorName,
      items: List.from(_cartItems),
      totalAmount: _subtotal,
      discountAmount: _totalDiscount,
      finalAmount: _total,
      taxRate: 22.0,
      paymentMethod: method,
      cashGiven: cashGiven,
      changeGiven: changeGiven,
      cashAmount: cashAmount,
      cardAmount: cardAmount,
      loyaltyPointsEarned: _pointsEarned,
      loyaltyPointsRedeemed: _loyaltyDiscount * 10,
      rtSimulationCode: rtCode,
      appointmentId: widget.initialAppointmentId,
    );

    // 1. Salva ed emette lo scontrino (sincronizza su Firestore + scarico magazzino)
    await checkoutRepo.emitReceipt(receipt, inventoryRepo: inventoryRepo);

    // 2. Aggiorna saldo punti fedeltà nel fidelity repository se presente cliente
    if (_customerId != null && _pointsEarned > 0) {
      fidelityRepo.awardPoints(_pointsEarned);
    }
    if (_customerId != null && _loyaltyDiscount > 0) {
      fidelityRepo.redeemPoints(_loyaltyDiscount * 10);
    }

    // 3. Mostra il Documento Commerciale Fiscale all'utente
    if (mounted) {
      _showFiscalReceiptDialog(receipt, salonName);
    }
  }

  void _showFiscalReceiptDialog(ReceiptModel receipt, String salonName) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: AppColors.white,
        child: Container(
          padding: const EdgeInsets.all(20),
          constraints: const BoxConstraints(maxWidth: 380),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Logo e Intestazione Fiscale
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.receipt_long, color: AppColors.emerald, size: 24),
                  const SizedBox(width: 8),
                  Text(
                    salonName.toUpperCase(),
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, letterSpacing: 0.5),
                  ),
                ],
              ),
              const Text('DOCUMENTO COMMERCIALE TELEMATICO', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.zinc500)),
              const Text('di vendita o prestazione', style: TextStyle(fontSize: 8, color: AppColors.zinc400)),
              const SizedBox(height: 8),
              Text(
                'Scontrino: ${receipt.receiptNumber} • ${DateFormat('dd/MM/yyyy HH:mm:ss').format(receipt.issuedAt)}',
                style: const TextStyle(fontSize: 10, color: AppColors.zinc600),
              ),
              Text('Operatore: ${receipt.operatorName} • Cliente: ${receipt.customerName}', style: const TextStyle(fontSize: 10, color: AppColors.zinc600)),
              const Divider(height: 16),

              // Lista voci scontrino
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    children: receipt.items.map((it) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              '${it.quantity}x ${it.name}',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            '€${it.totalPrice.toStringAsFixed(2)}',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    )).toList(),
                  ),
                ),
              ),

              const Divider(height: 16),

              // Scorporo IVA e Totale
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Subtotale lordo:', style: TextStyle(fontSize: 11, color: AppColors.zinc600)),
                  Text('€${receipt.totalAmount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                ],
              ),
              if (receipt.discountAmount > 0)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Sconto applicato:', style: TextStyle(fontSize: 11, color: AppColors.rose)),
                    Text('-€${receipt.discountAmount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.rose)),
                  ],
                ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Imponibile: €${receipt.netAmount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 10, color: AppColors.zinc500)),
                  Text('IVA 22%: €${receipt.vatAmount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 10, color: AppColors.zinc500)),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('TOTALE COMPLESSIVO:', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
                  Text(
                    '€${receipt.finalAmount.toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.zinc900),
                  ),
                ],
              ),

              const SizedBox(height: 8),

              // Metodo di pagamento
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.zinc50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.zinc200),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Pagamento: ${receipt.paymentMethod}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                    if (receipt.changeGiven != null && receipt.changeGiven! > 0)
                      Text('Resto: €${receipt.changeGiven!.toStringAsFixed(2)}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.emerald)),
                  ],
                ),
              ),

              const SizedBox(height: 8),

              // Sigillo RT Telematico
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.check_circle, size: 12, color: AppColors.emerald),
                  const SizedBox(width: 4),
                  Text('RT Fiscale: ${receipt.rtSimulationCode}', style: const TextStyle(fontSize: 9, color: AppColors.zinc500, fontFamily: 'monospace')),
                ],
              ),

              const SizedBox(height: 16),

              // Pulsante Nuovo Scontrino
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    setState(() {
                      _cartItems.clear();
                      _loyaltyDiscount = 0;
                      _manualDiscount = 0.0;
                      _useCarnetSession = false;
                      _customerName = 'Cliente Occasionale / Al Banco';
                      _customerId = null;
                      _customerPoints = 0;
                    });
                  },
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Nuovo Scontrino', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.obsidianBlack,
                    foregroundColor: AppColors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // MODALE STORICO SCONTRINI DI OGGI
  // --------------------------------------------------------------------------

  void _showTodayReceiptsModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        final checkoutRepo = context.watch<CheckoutRepository>();
        final todayList = checkoutRepo.todayReceipts;

        return SafeArea(
          top: false,
          child: Container(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.8),
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(color: AppColors.zinc300, borderRadius: BorderRadius.circular(2)),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Storico Scontrini di Oggi', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
                    Text('${todayList.length} emessi', style: const TextStyle(color: AppColors.zinc500, fontSize: 12)),
                  ],
                ),
                const SizedBox(height: 12),
                if (todayList.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(40),
                    child: Center(
                      child: Text('Nessuno scontrino emesso oggi.', style: TextStyle(color: AppColors.zinc400, fontSize: 13)),
                    ),
                  )
                else
                  Expanded(
                    child: ListView.separated(
                      itemCount: todayList.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (ctx, i) {
                        final r = todayList[i];
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(
                            radius: 16,
                            backgroundColor: AppColors.zinc100,
                            child: Icon(
                              r.paymentMethod == 'CONTANTI' ? Icons.payments_outlined : Icons.credit_card,
                              size: 16,
                              color: AppColors.zinc800,
                            ),
                          ),
                          title: Text(
                            '${r.receiptNumber} • ${r.customerName}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          subtitle: Text(
                            '${DateFormat('HH:mm').format(r.issuedAt)} • Metodo: ${r.paymentMethod} • Op: ${r.operatorName}',
                            style: const TextStyle(fontSize: 11, color: AppColors.zinc500),
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                '€${r.finalAmount.toStringAsFixed(2)}',
                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                              ),
                              IconButton(
                                icon: const Icon(Icons.print_outlined, size: 18, color: AppColors.zinc600),
                                onPressed: () {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Ristampa scontrino ${r.receiptNumber} inviata alla stampante RT.')),
                                  );
                                },
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ----------------------------------------------------------------------------
// MODALE AGGIUNTA ARTICOLI CON TAB (SERVIZI, PRODOTTI, VOCE LIBERA)
// ----------------------------------------------------------------------------

class _AddItemModal extends StatefulWidget {
  final List<SalonService> services;
  final List<ProductModel> products;
  final String operatorName;
  final Function(ReceiptItem) onAdd;

  const _AddItemModal({
    required this.services,
    required this.products,
    required this.operatorName,
    required this.onAdd,
  });

  @override
  State<_AddItemModal> createState() => _AddItemModalState();
}

class _AddItemModalState extends State<_AddItemModal> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchCtrl = TextEditingController();
  String _filter = '';

  // Voce libera
  final TextEditingController _customNameCtrl = TextEditingController();
  final TextEditingController _customPriceCtrl = TextEditingController();
  String _customType = 'SERVICE';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchCtrl.dispose();
    _customNameCtrl.dispose();
    _customPriceCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.8),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(color: AppColors.zinc300, borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 12),
          const Text('Aggiungi Voce allo Scontrino', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
          const SizedBox(height: 12),

          // Tab Bar
          TabBar(
            controller: _tabController,
            labelColor: AppColors.obsidianBlack,
            unselectedLabelColor: AppColors.zinc400,
            indicatorColor: AppColors.obsidianBlack,
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            tabs: const [
              Tab(text: 'Trattamenti'),
              Tab(text: 'Magazzino'),
              Tab(text: 'Voce Libera'),
            ],
          ),

          const SizedBox(height: 12),

          // Search bar (per i primi 2 tab)
          if (_tabController.index != 2)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: TextField(
                controller: _searchCtrl,
                decoration: InputDecoration(
                  hintText: 'Cerca voce...',
                  prefixIcon: const Icon(Icons.search, size: 18),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  filled: true,
                  fillColor: AppColors.zinc100,
                ),
                onChanged: (v) => setState(() => _filter = v.toLowerCase()),
              ),
            ),

          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // 1. Servizi Salone
                _buildServicesList(),
                // 2. Prodotti Magazzino
                _buildProductsList(),
                // 3. Voce libera personalizzata
                _buildCustomItemTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildServicesList() {
    final filtered = widget.services.where((s) => s.name.toLowerCase().contains(_filter)).toList();
    if (filtered.isEmpty) {
      return const Center(child: Text('Nessun servizio trovato.', style: TextStyle(color: AppColors.zinc400)));
    }
    return ListView.separated(
      itemCount: filtered.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (ctx, i) {
        final s = filtered[i];
        return ListTile(
          title: Text(s.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          subtitle: Text(s.category, style: const TextStyle(fontSize: 11, color: AppColors.zinc500)),
          trailing: Text('€${s.price.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
          onTap: () {
            widget.onAdd(ReceiptItem(
              id: s.id,
              type: 'SERVICE',
              name: s.name,
              price: s.price,
              quantity: 1,
              operatorName: widget.operatorName,
            ));
            Navigator.pop(context);
          },
        );
      },
    );
  }

  Widget _buildProductsList() {
    final filtered = widget.products.where((p) => p.name.toLowerCase().contains(_filter)).toList();
    if (filtered.isEmpty) {
      return const Center(child: Text('Nessun prodotto trovato in magazzino.', style: TextStyle(color: AppColors.zinc400)));
    }
    return ListView.separated(
      itemCount: filtered.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (ctx, i) {
        final p = filtered[i];
        return ListTile(
          title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          subtitle: Text('Giacenza: ${p.stockQuantity} ${p.unit} • ${p.brand}', style: const TextStyle(fontSize: 11, color: AppColors.zinc500)),
          trailing: Text('€${p.retailPrice.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
          onTap: () {
            widget.onAdd(ReceiptItem(
              id: p.id,
              type: 'PRODUCT',
              name: p.name,
              price: p.retailPrice,
              quantity: 1,
              operatorName: widget.operatorName,
            ));
            Navigator.pop(context);
          },
        );
      },
    );
  }

  Widget _buildCustomItemTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        children: [
          TextField(
            controller: _customNameCtrl,
            decoration: const InputDecoration(labelText: 'Descrizione Voce / Trattamento', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _customPriceCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Prezzo Lordo (€)', prefixText: '€ ', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ChoiceChip(
                  label: const Text('Servizio'),
                  selected: _customType == 'SERVICE',
                  onSelected: (_) => setState(() => _customType = 'SERVICE'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ChoiceChip(
                  label: const Text('Prodotto'),
                  selected: _customType == 'PRODUCT',
                  onSelected: (_) => setState(() => _customType = 'PRODUCT'),
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
                final name = _customNameCtrl.text.trim();
                final price = double.tryParse(_customPriceCtrl.text) ?? 0.0;
                if (name.isNotEmpty && price > 0) {
                  widget.onAdd(ReceiptItem(
                    id: 'custom_${DateTime.now().millisecondsSinceEpoch}',
                    type: _customType,
                    name: name,
                    price: price,
                    quantity: 1,
                    operatorName: widget.operatorName,
                  ));
                  Navigator.pop(context);
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.obsidianBlack),
              child: const Text('Aggiungi al Carrello', style: TextStyle(color: AppColors.white, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }
}

// ----------------------------------------------------------------------------
// SELETTORE CLIENTE CRM
// ----------------------------------------------------------------------------

class _ClientSelectorSheet extends StatefulWidget {
  final String? currentClientId;
  final Function(String name, String? phone, String? id, int points, String tier) onClientSelected;

  const _ClientSelectorSheet({
    required this.currentClientId,
    required this.onClientSelected,
  });

  @override
  State<_ClientSelectorSheet> createState() => _ClientSelectorSheetState();
}

class _ClientSelectorSheetState extends State<_ClientSelectorSheet> {
  final TextEditingController _searchCtrl = TextEditingController();
  String _query = '';
  List<Map<String, dynamic>> _clients = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchClients();
  }

  Future<void> _fetchClients() async {
    try {
      final snap = await FirebaseFirestore.instance
          .collection('users')
          .where('role', isEqualTo: 'cliente')
          .limit(30)
          .get();

      if (mounted) {
        setState(() {
          _clients = snap.docs.map((d) {
            final data = d.data();
            data['uid'] = d.id;
            return data;
          }).toList();
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _clients.where((c) {
      final name = (c['displayName'] ?? c['name'] ?? c['email'] ?? '').toString().toLowerCase();
      return name.contains(_query);
    }).toList();

    return SafeArea(
      top: false,
      child: Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(color: AppColors.zinc300, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 12),
            const Text('Seleziona Cliente', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
            const SizedBox(height: 10),

            // Tasto Rapido Cliente Occasionale
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(
                backgroundColor: AppColors.zinc100,
                child: Icon(Icons.person_outline, color: AppColors.zinc700),
              ),
              title: const Text('Cliente Occasionale / Al Banco', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: const Text('Scontrino rapido anonimo senza punti', style: TextStyle(fontSize: 11, color: AppColors.zinc500)),
              onTap: () {
                widget.onClientSelected('Cliente Occasionale / Al Banco', null, null, 0, 'Base');
                Navigator.pop(context);
              },
            ),

            const Divider(height: 16),

            TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Cerca cliente per nome o telefono...',
                prefixIcon: const Icon(Icons.search, size: 18),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                filled: true,
                fillColor: AppColors.zinc100,
              ),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),

            const SizedBox(height: 8),

            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : filtered.isEmpty
                      ? const Center(child: Text('Nessun cliente trovato.', style: TextStyle(color: AppColors.zinc400)))
                      : ListView.separated(
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (ctx, i) {
                            final c = filtered[i];
                            final name = c['displayName'] ?? c['name'] ?? c['email'] ?? 'Cliente';
                            final phone = c['phone'] as String?;
                            final id = c['uid'] as String?;
                            final points = (c['loyaltyPoints'] as num?)?.toInt() ?? 180;
                            final tier = c['loyaltyTier'] as String? ?? 'Silver Member';

                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: CircleAvatar(
                                backgroundColor: AppColors.obsidianBlack,
                                child: Text(name[0].toUpperCase(), style: const TextStyle(color: AppColors.white, fontWeight: FontWeight.bold)),
                              ),
                              title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              subtitle: Text('$tier • $points pt • ${phone ?? ""}', style: const TextStyle(fontSize: 11, color: AppColors.zinc500)),
                              onTap: () {
                                widget.onClientSelected(name, phone, id, points, tier);
                                Navigator.pop(context);
                              },
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
