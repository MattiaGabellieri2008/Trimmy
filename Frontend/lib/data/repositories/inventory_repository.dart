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
        _products = [];
      }
    } catch (e) {
      debugPrint('Firestore inventory fetch: $e');
      _products = [];
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
