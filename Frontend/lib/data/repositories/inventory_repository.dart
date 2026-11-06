import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import '../models/product_model.dart';

class InventoryRepository extends ChangeNotifier {
  static final List<ProductModel> defaultInitialProducts = [
    ProductModel(
      id: 'prd-shampoo-bio',
      tenantId: 'salone_default',
      name: 'Shampoo Ristrutturante Cheratina 250ml',
      brand: 'Trimmy Care',
      category: 'RIVENDITA',
      costPrice: 8.00,
      retailPrice: 18.50,
      stockQuantity: 14,
      minStockThreshold: 5,
      barcode: '8001234567890',
    ),
    ProductModel(
      id: 'prd-maschera-argan',
      tenantId: 'salone_default',
      name: 'Maschera Nutriente Olio di Argan 200ml',
      brand: 'Trimmy Luxury',
      category: 'RIVENDITA',
      costPrice: 10.00,
      retailPrice: 24.00,
      stockQuantity: 8,
      minStockThreshold: 3,
      barcode: '8001234567891',
    ),
    ProductModel(
      id: 'prd-cera-matte',
      tenantId: 'salone_default',
      name: 'Cera Modellante Effetto Matte 100ml',
      brand: 'Barber Lab',
      category: 'RIVENDITA',
      costPrice: 7.00,
      retailPrice: 16.00,
      stockQuantity: 12,
      minStockThreshold: 4,
      barcode: '8001234567892',
    ),
    ProductModel(
      id: 'prd-olio-barba',
      tenantId: 'salone_default',
      name: 'Olio Lucidante Barba & Baffi 50ml',
      brand: 'Barber Lab',
      category: 'RIVENDITA',
      costPrice: 6.50,
      retailPrice: 15.00,
      stockQuantity: 6,
      minStockThreshold: 2,
      barcode: '8001234567893',
    ),
  ];

  List<ProductModel> _products = List.from(defaultInitialProducts);
  bool _isLoading = false;
  String? _currentSalonId;

  List<ProductModel> get products => _products;
  bool get isLoading => _isLoading;
  int get lowStockCount => _products.where((p) => p.isLowStock).length;

  InventoryRepository();

  void setSalon(String salonId) {
    if (_currentSalonId == salonId) return;
    _currentSalonId = salonId;
    fetchProducts(salonId);
  }

  Future<void> fetchProducts(String salonId) async {
    _isLoading = true;
    notifyListeners();

    try {
      // Prova la subcollezione ufficiale 'prodotti', con fallback a 'inventory'
      var snap = await FirebaseFirestore.instance
          .collection('saloni')
          .doc(salonId)
          .collection('prodotti')
          .get();

      if (snap.docs.isEmpty) {
        snap = await FirebaseFirestore.instance
            .collection('saloni')
            .doc(salonId)
            .collection('inventory')
            .get();
      }

      if (snap.docs.isNotEmpty) {
        _products = snap.docs.map((doc) {
          final data = doc.data();
          data['id'] = doc.id;
          return ProductModel.fromJson(data);
        }).toList();
      } else {
        // Se non ci sono prodotti registrati, usa i prodotti default e salvali su Firestore
        _products = List.from(defaultInitialProducts);
        for (final p in _products) {
          try {
            await FirebaseFirestore.instance
                .collection('saloni')
                .doc(salonId)
                .collection('prodotti')
                .doc(p.id)
                .set(p.toJson());
          } catch (_) {}
        }
      }
    } catch (e) {
      debugPrint('Firestore inventory fetch: $e');
      if (_products.isEmpty) {
        _products = List.from(defaultInitialProducts);
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> updateStock(String productId, int newQuantity) async {
    final idx = _products.indexWhere((p) => p.id == productId);
    if (idx != -1) {
      _products[idx].stockQuantity = newQuantity;
      notifyListeners();

      if (_currentSalonId != null) {
        try {
          await FirebaseFirestore.instance
              .collection('saloni')
              .doc(_currentSalonId)
              .collection('prodotti')
              .doc(productId)
              .update({'stockQuantity': newQuantity});
        } catch (_) {}
        try {
          await FirebaseFirestore.instance
              .collection('saloni')
              .doc(_currentSalonId)
              .collection('inventory')
              .doc(productId)
              .update({'stockQuantity': newQuantity});
        } catch (e) {
          debugPrint('Firestore updateStock error: $e');
        }
      }
    }
  }

  Future<void> addProduct(ProductModel product) async {
    _products.add(product);
    notifyListeners();

    if (_currentSalonId != null) {
      try {
        await FirebaseFirestore.instance
            .collection('saloni')
            .doc(_currentSalonId)
            .collection('prodotti')
            .doc(product.id)
            .set(product.toJson());
      } catch (_) {}
      try {
        await FirebaseFirestore.instance
            .collection('saloni')
            .doc(_currentSalonId)
            .collection('inventory')
            .doc(product.id)
            .set(product.toJson());
      } catch (e) {
        debugPrint('Firestore addProduct error: $e');
      }
    }
  }

  Future<void> deleteProduct(String productId) async {
    _products.removeWhere((p) => p.id == productId);
    notifyListeners();

    if (_currentSalonId != null) {
      try {
        await FirebaseFirestore.instance
            .collection('saloni')
            .doc(_currentSalonId)
            .collection('prodotti')
            .doc(productId)
            .delete();
      } catch (_) {}
      try {
        await FirebaseFirestore.instance
            .collection('saloni')
            .doc(_currentSalonId)
            .collection('inventory')
            .doc(productId)
            .delete();
      } catch (e) {
        debugPrint('Firestore deleteProduct error: $e');
      }
    }
  }
}
