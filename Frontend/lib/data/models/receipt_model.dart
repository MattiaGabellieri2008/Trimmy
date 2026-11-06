import 'dart:math';

/// Rappresenta una singola voce all'interno dello scontrino di cassa POS
class ReceiptItem {
  final String id;
  final String type; // 'SERVICE' | 'PRODUCT' | 'CUSTOM' | 'PACKAGE'
  final String name;
  final double price;
  int quantity;
  final String? operatorName;
  final double taxRate; // es. 22.0 (%)

  ReceiptItem({
    required this.id,
    required this.type,
    required this.name,
    required this.price,
    this.quantity = 1,
    this.operatorName,
    this.taxRate = 22.0,
  });

  double get totalPrice => price * quantity;
  double get netPrice => totalPrice / (1 + (taxRate / 100.0));
  double get vatAmount => totalPrice - netPrice;

  factory ReceiptItem.fromJson(Map<String, dynamic> json) {
    return ReceiptItem(
      id: json['id'] as String? ?? 'item_${Random().nextInt(99999)}',
      type: json['type'] as String? ?? 'SERVICE',
      name: json['name'] as String? ?? 'Trattamento',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      operatorName: json['operatorName'] as String?,
      taxRate: (json['taxRate'] as num?)?.toDouble() ?? 22.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type,
      'name': name,
      'price': price,
      'quantity': quantity,
      if (operatorName != null) 'operatorName': operatorName,
      'taxRate': taxRate,
    };
  }
}

/// Rappresenta uno scontrino / transazione fiscale completata nel punto cassa POS
class ReceiptModel {
  final String id;
  final String tenantId;
  final String receiptNumber; // es. SF-20261105-001
  final DateTime issuedAt;
  final String? customerId;
  final String customerName;
  final String? customerPhone;
  final String operatorName;
  final List<ReceiptItem> items;
  final double totalAmount; // Subtotale lordo prima degli sconti
  final double discountAmount; // Sconto applicato (punti fedeltà o manuale)
  final double finalAmount; // Totale effettivo incassato
  final double taxRate; // 22.0
  final String paymentMethod; // 'CASH' | 'CARD' | 'SATISPAY' | 'MIXED'
  final double? cashGiven; // Contanti ricevuti dal cliente
  final double? changeGiven; // Resto consegnato
  final double? cashAmount; // Quota contanti (per pagamento misto)
  final double? cardAmount; // Quota carta/POS (per pagamento misto)
  final int loyaltyPointsEarned;
  final int loyaltyPointsRedeemed;
  final String rtSimulationCode; // Codice telematico RT Agenzia Entrate
  final String? notes;
  final bool isVoided; // Annullato / Nota di credito
  final String? appointmentId;

  ReceiptModel({
    required this.id,
    required this.tenantId,
    required this.receiptNumber,
    required this.issuedAt,
    this.customerId,
    this.customerName = 'Cliente Occasionale / Al Banco',
    this.customerPhone,
    this.operatorName = 'Staff Cassa',
    required this.items,
    required this.totalAmount,
    this.discountAmount = 0.0,
    required this.finalAmount,
    this.taxRate = 22.0,
    required this.paymentMethod,
    this.cashGiven,
    this.changeGiven,
    this.cashAmount,
    this.cardAmount,
    this.loyaltyPointsEarned = 0,
    this.loyaltyPointsRedeemed = 0,
    required this.rtSimulationCode,
    this.notes,
    this.isVoided = false,
    this.appointmentId,
  });

  /// Imponibile netto scorporando l'IVA
  double get netAmount => finalAmount / (1 + (taxRate / 100.0));

  /// Imposta IVA al 22%
  double get vatAmount => finalAmount - netAmount;

  factory ReceiptModel.fromJson(Map<String, dynamic> json) {
    final itemsRaw = json['items'] as List<dynamic>? ?? [];
    final itemsList = itemsRaw
        .map((i) => ReceiptItem.fromJson(i as Map<String, dynamic>))
        .toList();

    DateTime parsedDate;
    if (json['issuedAt'] is String) {
      parsedDate = DateTime.tryParse(json['issuedAt'] as String) ?? DateTime.now();
    } else {
      parsedDate = DateTime.now();
    }

    final total = (json['totalAmount'] as num?)?.toDouble() ?? 0.0;
    final discount = (json['discountAmount'] as num?)?.toDouble() ?? 0.0;
    final finalAmt = (json['finalAmount'] as num?)?.toDouble() ?? (total - discount);

    return ReceiptModel(
      id: json['id'] as String? ?? 'tx_${DateTime.now().millisecondsSinceEpoch}',
      tenantId: json['tenantId'] as String? ?? 'salone_default',
      receiptNumber: json['receiptNumber'] as String? ?? 'SF-${parsedDate.year}${parsedDate.month.toString().padLeft(2, '0')}${parsedDate.day.toString().padLeft(2, '0')}-001',
      issuedAt: parsedDate,
      customerId: json['customerId'] as String?,
      customerName: json['customerName'] as String? ?? 'Cliente Occasionale / Al Banco',
      customerPhone: json['customerPhone'] as String?,
      operatorName: json['operatorName'] as String? ?? 'Staff Cassa',
      items: itemsList,
      totalAmount: total,
      discountAmount: discount,
      finalAmount: finalAmt,
      taxRate: (json['taxRate'] as num?)?.toDouble() ?? 22.0,
      paymentMethod: json['paymentMethod'] as String? ?? 'CASH',
      cashGiven: (json['cashGiven'] as num?)?.toDouble(),
      changeGiven: (json['changeGiven'] as num?)?.toDouble(),
      cashAmount: (json['cashAmount'] as num?)?.toDouble(),
      cardAmount: (json['cardAmount'] as num?)?.toDouble(),
      loyaltyPointsEarned: (json['loyaltyPointsEarned'] as num?)?.toInt() ?? 0,
      loyaltyPointsRedeemed: (json['loyaltyPointsRedeemed'] as num?)?.toInt() ?? 0,
      rtSimulationCode: json['rtSimulationCode'] as String? ?? 'RT-TRIMMY-${Random().nextInt(999999)}',
      notes: json['notes'] as String?,
      isVoided: json['isVoided'] as bool? ?? false,
      appointmentId: json['appointmentId'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'tenantId': tenantId,
      'receiptNumber': receiptNumber,
      'issuedAt': issuedAt.toIso8601String(),
      if (customerId != null) 'customerId': customerId,
      'customerName': customerName,
      if (customerPhone != null) 'customerPhone': customerPhone,
      'operatorName': operatorName,
      'items': items.map((i) => i.toJson()).toList(),
      'totalAmount': totalAmount,
      'discountAmount': discountAmount,
      'finalAmount': finalAmount,
      'taxRate': taxRate,
      'paymentMethod': paymentMethod,
      if (cashGiven != null) 'cashGiven': cashGiven,
      if (changeGiven != null) 'changeGiven': changeGiven,
      if (cashAmount != null) 'cashAmount': cashAmount,
      if (cardAmount != null) 'cardAmount': cardAmount,
      'loyaltyPointsEarned': loyaltyPointsEarned,
      'loyaltyPointsRedeemed': loyaltyPointsRedeemed,
      'rtSimulationCode': rtSimulationCode,
      if (notes != null) 'notes': notes,
      'isVoided': isVoided,
      if (appointmentId != null) 'appointmentId': appointmentId,
    };
  }
}

/// Modello per la Chiusura Fiscale Giornaliera di Cassa (Report Z)
class DailyCashClosingModel {
  final String dateStr; // YYYY-MM-DD
  final String tenantId;
  final DateTime closedAt;
  final double totalRevenue;
  final double cashTotal;
  final double cardTotal;
  final double satispayTotal;
  final int transactionsCount;
  final double averageTicket;
  final double totalVat; // IVA 22% totale
  final double initialDrawerCash; // Fondo cassa iniziale (es. 150.00)
  final double totalCashInDrawer; // Fondo iniziale + contanti incassati
  final double actualCashCounted; // Contanti contati effettivamente
  final double cashDifference; // actualCashCounted - totalCashInDrawer
  final List<Map<String, dynamic>> topTreatments;
  final String closedBy;
  final String? notes;
  final bool isSealed;

  DailyCashClosingModel({
    required this.dateStr,
    required this.tenantId,
    required this.closedAt,
    required this.totalRevenue,
    required this.cashTotal,
    required this.cardTotal,
    this.satispayTotal = 0.0,
    required this.transactionsCount,
    required this.averageTicket,
    required this.totalVat,
    this.initialDrawerCash = 150.0,
    required this.totalCashInDrawer,
    required this.actualCashCounted,
    this.cashDifference = 0.0,
    this.topTreatments = const [],
    this.closedBy = 'Titolare',
    this.notes,
    this.isSealed = true,
  });

  factory DailyCashClosingModel.fromJson(Map<String, dynamic> json) {
    DateTime parsedClosedAt;
    if (json['closedAt'] is String) {
      parsedClosedAt = DateTime.tryParse(json['closedAt'] as String) ?? DateTime.now();
    } else {
      parsedClosedAt = DateTime.now();
    }

    final topRaw = json['topTreatments'] as List<dynamic>? ?? [];
    final topList = topRaw.map((e) => Map<String, dynamic>.from(e as Map)).toList();

    return DailyCashClosingModel(
      dateStr: json['dateStr'] as String? ?? '2026-11-05',
      tenantId: json['tenantId'] as String? ?? 'salone_default',
      closedAt: parsedClosedAt,
      totalRevenue: (json['totalRevenue'] as num?)?.toDouble() ?? 0.0,
      cashTotal: (json['cashTotal'] as num?)?.toDouble() ?? 0.0,
      cardTotal: (json['cardTotal'] as num?)?.toDouble() ?? 0.0,
      satispayTotal: (json['satispayTotal'] as num?)?.toDouble() ?? 0.0,
      transactionsCount: (json['transactionsCount'] as num?)?.toInt() ?? 0,
      averageTicket: (json['averageTicket'] as num?)?.toDouble() ?? 0.0,
      totalVat: (json['totalVat'] as num?)?.toDouble() ?? 0.0,
      initialDrawerCash: (json['initialDrawerCash'] as num?)?.toDouble() ?? 150.0,
      totalCashInDrawer: (json['totalCashInDrawer'] as num?)?.toDouble() ?? 0.0,
      actualCashCounted: (json['actualCashCounted'] as num?)?.toDouble() ?? 0.0,
      cashDifference: (json['cashDifference'] as num?)?.toDouble() ?? 0.0,
      topTreatments: topList,
      closedBy: json['closedBy'] as String? ?? 'Titolare',
      notes: json['notes'] as String?,
      isSealed: json['isSealed'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'dateStr': dateStr,
      'tenantId': tenantId,
      'closedAt': closedAt.toIso8601String(),
      'totalRevenue': totalRevenue,
      'cashTotal': cashTotal,
      'cardTotal': cardTotal,
      'satispayTotal': satispayTotal,
      'transactionsCount': transactionsCount,
      'averageTicket': averageTicket,
      'totalVat': totalVat,
      'initialDrawerCash': initialDrawerCash,
      'totalCashInDrawer': totalCashInDrawer,
      'actualCashCounted': actualCashCounted,
      'cashDifference': cashDifference,
      'topTreatments': topTreatments,
      'closedBy': closedBy,
      if (notes != null) 'notes': notes,
      'isSealed': isSealed,
    };
  }
}

