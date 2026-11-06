import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/receipt_model.dart';
import 'inventory_repository.dart';

class CheckoutRepository extends ChangeNotifier {
  static const String _storagePrefix = 'trimmy_pos_receipts_';
  static const String _closingsPrefix = 'trimmy_pos_closings_';

  List<ReceiptModel> _receipts = [];
  bool _isLoading = false;
  String _currentSalonId = 'salone_default';
  StreamSubscription<QuerySnapshot>? _firestoreSub;

  List<ReceiptModel> get allReceipts => _receipts;
  bool get isLoading => _isLoading;
  String get currentSalonId => _currentSalonId;

  CheckoutRepository() {
    _loadFromLocalCache();
  }

  @override
  void dispose() {
    _firestoreSub?.cancel();
    super.dispose();
  }

  /// Inizializza il repository per uno specifico salone e avvia la sincronizzazione Firestore
  void setSalon(String salonId) {
    if (salonId.isEmpty) return;
    if (_currentSalonId == salonId && _firestoreSub != null) return;
    _currentSalonId = salonId;
    _loadFromLocalCache();
    _initFirestoreSync();
  }

  /// Avvia la sincronizzazione in tempo reale con Google Cloud Firestore
  void _initFirestoreSync() {
    _firestoreSub?.cancel();

    try {
      _isLoading = true;
      notifyListeners();

      _firestoreSub = FirebaseFirestore.instance
          .collection('saloni')
          .doc(_currentSalonId)
          .collection('transactions')
          .orderBy('issuedAt', descending: true)
          .limit(150)
          .snapshots()
          .listen((snapshot) {
        if (snapshot.docs.isNotEmpty) {
          final cloudReceipts = snapshot.docs.map((doc) {
            final data = doc.data();
            data['id'] = doc.id;
            return ReceiptModel.fromJson(data);
          }).toList();

          _mergeAndSave(cloudReceipts);
        }
        _isLoading = false;
        notifyListeners();
      }, onError: (err) {
        debugPrint('Firestore transactions listener info/fallback: $err');
        _isLoading = false;
        notifyListeners();
      });
    } catch (e) {
      debugPrint('Firestore non disponibile per transactions: $e');
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Salva in cache locale sincrona per supporto 100% offline-first
  Future<void> _loadFromLocalCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('$_storagePrefix$_currentSalonId');
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw) as List<dynamic>;
        _receipts = decoded
            .map((item) => ReceiptModel.fromJson(item as Map<String, dynamic>))
            .toList();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Errore caricamento scontrini da cache locale: $e');
    }
  }

  Future<void> _saveToLocalCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final encoded = jsonEncode(_receipts.map((r) => r.toJson()).toList());
      await prefs.setString('$_storagePrefix$_currentSalonId', encoded);
    } catch (e) {
      debugPrint('Errore salvataggio scontrini su cache locale: $e');
    }
  }

  void _mergeAndSave(List<ReceiptModel> cloudList) {
    final Map<String, ReceiptModel> map = {};
    for (final r in _receipts) {
      map[r.id] = r;
    }
    for (final r in cloudList) {
      map[r.id] = r;
    }
    _receipts = map.values.toList();
    _receipts.sort((a, b) => b.issuedAt.compareTo(a.issuedAt));
    _saveToLocalCache();
  }

  /// Genera il prossimo numero progressivo scontrino per la data odierna
  String getNextReceiptNumber([DateTime? date]) {
    final d = date ?? DateTime.now();
    final datePrefix = 'SF-${d.year}${d.month.toString().padLeft(2, '0')}${d.day.toString().padLeft(2, '0')}';
    final todayReceipts = getReceiptsForDate(d);
    final count = todayReceipts.length + 1;
    return '$datePrefix-${count.toString().padLeft(3, '0')}';
  }

  /// Ottiene gli scontrini per una specifica giornata
  List<ReceiptModel> getReceiptsForDate(DateTime date) {
    return _receipts.where((r) {
      return r.issuedAt.year == date.year &&
          r.issuedAt.month == date.month &&
          r.issuedAt.day == date.day &&
          !r.isVoided;
    }).toList();
  }

  /// Scontrini di oggi (attivi ed emessi)
  List<ReceiptModel> get todayReceipts => getReceiptsForDate(DateTime.now());

  /// Registra ed emette ufficialmente uno scontrino fiscale nel punto cassa POS
  Future<void> emitReceipt(ReceiptModel receipt, {InventoryRepository? inventoryRepo}) async {
    // 1. Aggiungi subito localmente
    _receipts.removeWhere((r) => r.id == receipt.id);
    _receipts.insert(0, receipt);
    notifyListeners();
    await _saveToLocalCache();

    // 2. Sincronizzazione su Google Cloud Firestore
    try {
      final batch = FirebaseFirestore.instance.batch();

      // Scrittura nella subcollezione salone: /saloni/{salonId}/transactions/{txId}
      final salonTxRef = FirebaseFirestore.instance
          .collection('saloni')
          .doc(receipt.tenantId)
          .collection('transactions')
          .doc(receipt.id);
      batch.set(salonTxRef, receipt.toJson(), SetOptions(merge: true));

      // Scrittura nella collezione globale ridondante per query rapide: /transactions/{txId}
      final globalTxRef = FirebaseFirestore.instance
          .collection('transactions')
          .doc(receipt.id);
      batch.set(globalTxRef, receipt.toJson(), SetOptions(merge: true));

      // Se collegato ad un appuntamento dell'agenda, segnalalo come saldato/completato
      if (receipt.appointmentId != null && receipt.appointmentId!.isNotEmpty) {
        final apptRef = FirebaseFirestore.instance
            .collection('saloni')
            .doc(receipt.tenantId)
            .collection('appuntamenti')
            .doc(receipt.appointmentId);
        batch.set(apptRef, {
          'status': 'COMPLETED',
          'paid': true,
          'transactionId': receipt.id,
          'paidAt': receipt.issuedAt.toIso8601String(),
        }, SetOptions(merge: true));

        final globalApptRef = FirebaseFirestore.instance
            .collection('appointments')
            .doc(receipt.appointmentId);
        batch.set(globalApptRef, {
          'status': 'COMPLETED',
          'paid': true,
          'transactionId': receipt.id,
          'paidAt': receipt.issuedAt.toIso8601String(),
        }, SetOptions(merge: true));
      }

      await batch.commit();
      debugPrint('Scontrino ${receipt.receiptNumber} sincronizzato con successo su Firestore!');
    } catch (e) {
      debugPrint('Nota salvataggio scontrino Firestore (sarà sincronizzato offline): $e');
    }

    // 3. Scarico automatico scorte magazzino per i prodotti venduti alla cassa
    if (inventoryRepo != null) {
      for (final item in receipt.items) {
        if (item.type == 'PRODUCT') {
          final prod = inventoryRepo.products.where((p) => p.id == item.id).firstOrNull;
          if (prod != null) {
            final newQty = (prod.stockQuantity - item.quantity).clamp(0, 99999);
            inventoryRepo.updateStock(item.id, newQty);
          }
        }
      }
    }
  }

  /// Annullamento scontrino (Emissione Nota di Credito)
  Future<void> voidReceipt(String receiptId) async {
    final idx = _receipts.indexWhere((r) => r.id == receiptId);
    if (idx != -1) {
      final old = _receipts[idx];
      final voided = ReceiptModel(
        id: old.id,
        tenantId: old.tenantId,
        receiptNumber: old.receiptNumber,
        issuedAt: old.issuedAt,
        customerId: old.customerId,
        customerName: old.customerName,
        customerPhone: old.customerPhone,
        operatorName: old.operatorName,
        items: old.items,
        totalAmount: old.totalAmount,
        discountAmount: old.discountAmount,
        finalAmount: old.finalAmount,
        taxRate: old.taxRate,
        paymentMethod: old.paymentMethod,
        cashGiven: old.cashGiven,
        changeGiven: old.changeGiven,
        cashAmount: old.cashAmount,
        cardAmount: old.cardAmount,
        loyaltyPointsEarned: old.loyaltyPointsEarned,
        loyaltyPointsRedeemed: old.loyaltyPointsRedeemed,
        rtSimulationCode: old.rtSimulationCode,
        notes: '${old.notes ?? ""} [ANNULLATO / NOTA DI CREDITO]',
        isVoided: true,
        appointmentId: old.appointmentId,
      );

      _receipts[idx] = voided;
      notifyListeners();
      await _saveToLocalCache();

      try {
        await FirebaseFirestore.instance
            .collection('saloni')
            .doc(_currentSalonId)
            .collection('transactions')
            .doc(receiptId)
            .update({'isVoided': true, 'notes': voided.notes});
      } catch (e) {
        debugPrint('Errore voidReceipt su Firestore: $e');
      }
    }
  }

  /// Calcola i dati aggregati reali della Chiusura Fiscale Cassa per una data
  DailyCashClosingModel calculateDailyClosing(
    DateTime date, {
    double initialDrawerCash = 150.0,
    double? actualCashCounted,
    String closedBy = 'Titolare',
    String? notes,
  }) {
    final dayTxs = getReceiptsForDate(date);

    double totalRevenue = 0.0;
    double cashTotal = 0.0;
    double cardTotal = 0.0;
    double satispayTotal = 0.0;
    double totalVat = 0.0;

    final Map<String, Map<String, dynamic>> treatmentMap = {};

    for (final tx in dayTxs) {
      totalRevenue += tx.finalAmount;
      totalVat += tx.vatAmount;

      if (tx.paymentMethod == 'CONTANTI' || tx.paymentMethod == 'CASH') {
        cashTotal += tx.finalAmount;
      } else if (tx.paymentMethod == 'CARTA_POS' || tx.paymentMethod == 'CARD') {
        cardTotal += tx.finalAmount;
      } else if (tx.paymentMethod == 'SATISPAY') {
        satispayTotal += tx.finalAmount;
      } else if (tx.paymentMethod == 'MISTO' || tx.paymentMethod == 'MIXED') {
        cashTotal += tx.cashAmount ?? 0.0;
        cardTotal += tx.cardAmount ?? 0.0;
      }

      for (final item in tx.items) {
        if (!treatmentMap.containsKey(item.name)) {
          treatmentMap[item.name] = {
            'name': item.name,
            'type': item.type,
            'count': 0,
            'revenue': 0.0,
          };
        }
        treatmentMap[item.name]!['count'] = (treatmentMap[item.name]!['count'] as int) + item.quantity;
        treatmentMap[item.name]!['revenue'] = (treatmentMap[item.name]!['revenue'] as double) + item.totalPrice;
      }
    }

    final topTreatments = treatmentMap.values.toList()
      ..sort((a, b) => (b['revenue'] as double).compareTo(a['revenue'] as double));

    final count = dayTxs.length;
    final avgTicket = count > 0 ? (totalRevenue / count) : 0.0;
    final totalDrawerCash = initialDrawerCash + cashTotal;
    final counted = actualCashCounted ?? totalDrawerCash;
    final diff = counted - totalDrawerCash;

    final dateStr = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

    return DailyCashClosingModel(
      dateStr: dateStr,
      tenantId: _currentSalonId,
      closedAt: DateTime.now(),
      totalRevenue: totalRevenue,
      cashTotal: cashTotal,
      cardTotal: cardTotal,
      satispayTotal: satispayTotal,
      transactionsCount: count,
      averageTicket: avgTicket,
      totalVat: totalVat,
      initialDrawerCash: initialDrawerCash,
      totalCashInDrawer: totalDrawerCash,
      actualCashCounted: counted,
      cashDifference: diff,
      topTreatments: topTreatments.take(5).toList(),
      closedBy: closedBy,
      notes: notes,
      isSealed: true,
    );
  }

  /// Salva e sigilla la Chiusura Fiscale di Cassa su Google Cloud Firestore
  Future<void> saveDailyClosing(DailyCashClosingModel closing) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('$_closingsPrefix${_currentSalonId}_${closing.dateStr}', jsonEncode(closing.toJson()));

      final batch = FirebaseFirestore.instance.batch();

      // 1. Sottocollezione ufficiale: /saloni/{salonId}/daily_closings/{dateStr}
      final ref1 = FirebaseFirestore.instance
          .collection('saloni')
          .doc(closing.tenantId)
          .collection('daily_closings')
          .doc(closing.dateStr);
      batch.set(ref1, closing.toJson(), SetOptions(merge: true));

      // 2. Sottocollezione parallela web-app compatibile: /saloni/{salonId}/closings/{dateStr}
      final ref2 = FirebaseFirestore.instance
          .collection('saloni')
          .doc(closing.tenantId)
          .collection('closings')
          .doc(closing.dateStr);
      batch.set(ref2, closing.toJson(), SetOptions(merge: true));

      await batch.commit();
      debugPrint('Chiusura di cassa ${closing.dateStr} salvata e sigillata su Firestore!');
    } catch (e) {
      debugPrint('Nota salvataggio chiusura cassa Firestore: $e');
    }
  }

  /// Recupera una chiusura salvata in precedenza per una certa data
  Future<DailyCashClosingModel?> getSavedDailyClosing(DateTime date) async {
    final dateStr = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

    try {
      // 1. Prova prima da Cloud Firestore
      final snap = await FirebaseFirestore.instance
          .collection('saloni')
          .doc(_currentSalonId)
          .collection('daily_closings')
          .doc(dateStr)
          .get();

      if (snap.exists && snap.data() != null) {
        return DailyCashClosingModel.fromJson(snap.data()!);
      }
    } catch (e) {
      debugPrint('Firestore fetch closing fallback: $e');
    }

    // 2. Fallback da SharedPreferences locale
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('$_closingsPrefix${_currentSalonId}_$dateStr');
      if (raw != null && raw.isNotEmpty) {
        return DailyCashClosingModel.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      }
    } catch (_) {}

    return null;
  }
}
