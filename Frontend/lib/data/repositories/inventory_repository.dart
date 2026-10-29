import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import '../models/product_model.dart';

class InventoryRepository extends ChangeNotifier {
  List<ProductModel> _products = [];
  bool _isLoading = false;
  String? _currentSalonId;

  List<ProductModel> get products => _products;
  bool get isLoading => _isLoading;
  int get lowStockCount => _products.where((p) => p.isLowStock).length;

  InventoryRepository() {
    _loadSeedProducts();
  }

  void setSalon(String salonId) {
    if (_currentSalonId == salonId) return;
    _currentSalonId = salonId;
    fetchProducts(salonId);
  }

  Future<void> fetchProducts(String salonId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final snap = await FirebaseFirestore.instance
          .collection('saloni')
          .doc(salonId)
          .collection('inventory')
          .get();

      if (snap.docs.isNotEmpty) {
        _products = snap.docs.map((doc) {
          final data = doc.data();
          data['id'] = doc.id;
          return ProductModel.fromJson(data);
        }).toList();
      } else {
        _loadSeedProducts();
      }
    } catch (e) {
      debugPrint('Firestore inventory fetch fallback: $e');
      if (_products.isEmpty) {
        _loadSeedProducts();
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
            .collection('inventory')
            .doc(product.id)
            .set(product.toJson());
      } catch (e) {
        debugPrint('Firestore addProduct error: $e');
      }
    }
  }

  void _loadSeedProducts() {
    _products = [
      ProductModel(
        id: 'prod-shampoo-bio',
        tenantId: 'salon-1',
        name: 'Shampoo Ristrutturante Bio 250ml',
        brand: 'Kérastase',
        category: 'RIVENDITA',
        costPrice: 8.50,
        retailPrice: 24.00,
        stockQuantity: 12,
        minStockThreshold: 4,
      ),
      ProductModel(
        id: 'prod-maschera-cheratina',
        tenantId: 'salon-1',
        name: 'Maschera Nutritiva Cheratina 500ml',
        brand: 'L\'Oréal Professionnel',
        category: 'RIVENDITA',
        costPrice: 12.00,
        retailPrice: 32.00,
        stockQuantity: 2, // Sottoscorta!
        minStockThreshold: 3,
      ),
      ProductModel(
        id: 'prod-ossigeno-20v',
        tenantId: 'salon-1',
        name: 'Ossidante in Crema 20 Volumi 1000ml',
        brand: 'Wella Professionals',
        category: 'USO_INTERNO',
        costPrice: 6.80,
        retailPrice: 0.0,
        stockQuantity: 8,
        minStockThreshold: 2,
      ),
      ProductModel(
        id: 'prod-olio-barba',
        tenantId: 'salon-1',
        name: 'Olio Idratante Barba al Sandalo 50ml',
        brand: 'Proraso Professional',
        category: 'RIVENDITA',
        costPrice: 5.50,
        retailPrice: 18.00,
        stockQuantity: 1, // Sottoscorta!
        minStockThreshold: 3,
      ),
      ProductModel(
        id: 'prod-decolorante-polvere',
        tenantId: 'salon-1',
        name: 'Polvere Decolorante Blu 500g',
        brand: 'Schwarzkopf Blondme',
        category: 'USO_INTERNO',
        costPrice: 14.50,
        retailPrice: 0.0,
        stockQuantity: 5,
        minStockThreshold: 2,
      ),
    ];
  }
}

