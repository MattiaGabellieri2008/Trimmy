class ProductModel {
  final String id;
  final String tenantId;
  final String name;
  final String brand;
  final String category; // 'RIVENDITA' | 'USO_INTERNO'
  final String? barcode;
  final double costPrice;
  final double retailPrice;
  int stockQuantity;
  final int minStockThreshold;
  final String unit;

  ProductModel({
    required this.id,
    required this.tenantId,
    required this.name,
    required this.brand,
    required this.category,
    this.barcode,
    required this.costPrice,
    required this.retailPrice,
    required this.stockQuantity,
    this.minStockThreshold = 3,
    this.unit = 'pz',
  });

  bool get isLowStock => stockQuantity <= minStockThreshold;
  bool get isRetail => category == 'RIVENDITA';

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    return ProductModel(
      id: json['id'] as String? ?? '',
      tenantId: json['tenantId'] as String? ?? '',
      name: json['name'] as String? ?? 'Prodotto senza nome',
      brand: json['brand'] as String? ?? 'Trimmy Care',
      category: json['category'] as String? ?? 'RIVENDITA',
      barcode: json['barcode'] as String?,
      costPrice: (json['costPrice'] as num?)?.toDouble() ?? 0.0,
      retailPrice: (json['retailPrice'] as num?)?.toDouble() ?? 0.0,
      stockQuantity: (json['stockQuantity'] as num?)?.toInt() ?? 0,
      minStockThreshold: (json['minStockThreshold'] as num?)?.toInt() ?? 3,
      unit: json['unit'] as String? ?? 'pz',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'tenantId': tenantId,
      'name': name,
      'brand': brand,
      'category': category,
      'barcode': barcode,
      'costPrice': costPrice,
      'retailPrice': retailPrice,
      'stockQuantity': stockQuantity,
      'minStockThreshold': minStockThreshold,
      'unit': unit,
    };
  }
}

