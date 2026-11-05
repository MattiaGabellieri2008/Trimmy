import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import '../models/salon_model.dart';
import '../models/service_model.dart';

class SalonRepository extends ChangeNotifier {
  final List<Salon> _salons = [];
  bool _isLoading = false;
  StreamSubscription<QuerySnapshot>? _salonsSub;
  StreamSubscription<QuerySnapshot>? _usersSub;
  StreamSubscription<QuerySnapshot>? _servicesSub;
  String? _currentServicesSalonId;

  List<SalonService> _services = [];

  List<Salon> get salons => _salons;
  List<SalonService> get services => _services;
  bool get isLoading => _isLoading;

  SalonRepository() {
    _initFirestoreSync();
  }

  @override
  void dispose() {
    _salonsSub?.cancel();
    _usersSub?.cancel();
    _servicesSub?.cancel();
    super.dispose();
  }

  void _initFirestoreSync() {
    try {
      // 1. Ascolta in tempo reale la collezione /saloni di Firestore
      _salonsSub = FirebaseFirestore.instance
          .collection('saloni')
          .snapshots()
          .listen((snapshot) {
        if (snapshot.docs.isNotEmpty) {
          for (final doc in snapshot.docs) {
            _mergeOrUpdateSalon(doc.id, doc.data());
          }
          notifyListeners();
        }
      }, onError: (err) {
        debugPrint('Errore sync Firestore saloni: $err');
      });

      // 2. Ascolta anche gli utenti con ruolo "salone" per rilevare nuovi titolari
      _usersSub = FirebaseFirestore.instance
          .collection('users')
          .where('role', whereIn: ['salone', 'salon'])
          .snapshots()
          .listen((snapshot) {
        if (snapshot.docs.isNotEmpty) {
          for (final doc in snapshot.docs) {
            final data = doc.data();
            final salonId = data['salonId'] as String? ?? doc.id;
            _mergeOrUpdateSalon(salonId, data);
          }
          notifyListeners();
        }
      }, onError: (err) {
        debugPrint('Errore sync Firestore utenti salone: $err');
      });
    } catch (e) {
      debugPrint('Firestore non disponibile per SalonRepository: $e');
    }
  }

  /// Sincronizza i servizi reali di un salone specifico da Firestore
  void syncSalonServices(String salonId) {
    if (_currentServicesSalonId == salonId && _servicesSub != null) return;
    _currentServicesSalonId = salonId;
    _servicesSub?.cancel();

    try {
      _servicesSub = FirebaseFirestore.instance
          .collection('saloni')
          .doc(salonId)
          .collection('servizi')
          .snapshots()
          .listen((snapshot) {
        if (snapshot.docs.isNotEmpty) {
          _services = snapshot.docs.map((doc) {
            final data = doc.data();
            data['id'] = doc.id;
            return SalonService.fromJson(data);
          }).toList();
        } else {
          // Se la collezione è vuota su Firestore per questo salone, inizializza con i servizi base reali salvandoli
          _initializeDefaultServicesForSalon(salonId);
        }
        notifyListeners();
      }, onError: (e) {
        debugPrint('Errore ascolto servizi salone $salonId: $e');
      });
    } catch (e) {
      debugPrint('Errore setup listener servizi: $e');
    }
  }

  Future<void> _initializeDefaultServicesForSalon(String salonId) async {
    final defaultServices = [
      const SalonService(
        id: 'srv-taglio-d',
        name: 'Taglio Sartoriale & Piega Luxury',
        category: 'Taglio & Piega',
        price: 45.0,
        durationMinutes: 45,
        description: 'Consulenza morfologica, shampoo con massaggio relax, taglio sartoriale e piega gloss.',
      ),
      const SalonService(
        id: 'srv-piega',
        name: 'Piega & Styling Glamour',
        category: 'Taglio & Piega',
        price: 25.0,
        durationMinutes: 30,
        description: 'Piega a phon con prodotti termo-protettivi e styling a onde o liscio specchio.',
      ),
      const SalonService(
        id: 'srv-balayage',
        name: 'Balayage Sfumato & Gloss',
        category: 'Colore',
        price: 95.0,
        durationMinutes: 90,
        description: 'Schiariture a mano libera con tonalizzazione lucida illuminante senza ammoniaca.',
      ),
      const SalonService(
        id: 'srv-barba',
        name: 'Rasatura Tradizionale & Panno Caldo',
        category: 'Barba',
        price: 22.0,
        durationMinutes: 25,
        description: 'Rituale rasatura con panni caldi all\'eucalipto, lozione dopobarba e balsamo nutritivo.',
      ),
    ];

    try {
      final batch = FirebaseFirestore.instance.batch();
      for (final s in defaultServices) {
        final docRef = FirebaseFirestore.instance
            .collection('saloni')
            .doc(salonId)
            .collection('servizi')
            .doc(s.id);
        batch.set(docRef, s.toJson(), SetOptions(merge: true));
      }
      await batch.commit();
    } catch (e) {
      debugPrint('Errore inizializzazione servizi standard Firestore: $e');
      _services = List.from(defaultServices);
      notifyListeners();
    }
  }

  /// Aggiunge un nuovo servizio su Cloud Firestore e nello stato locale
  Future<bool> addService(SalonService service, {required String salonId}) async {
    try {
      final docRef = FirebaseFirestore.instance
          .collection('saloni')
          .doc(salonId)
          .collection('servizi')
          .doc(service.id.isNotEmpty ? service.id : null);

      final serviceWithId = SalonService(
        id: docRef.id,
        name: service.name,
        category: service.category,
        price: service.price,
        durationMinutes: service.durationMinutes,
        description: service.description,
      );

      await docRef.set(serviceWithId.toJson(), SetOptions(merge: true));

      final existingIdx = _services.indexWhere((s) => s.id == serviceWithId.id);
      if (existingIdx != -1) {
        _services[existingIdx] = serviceWithId;
      } else {
        _services.add(serviceWithId);
      }
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Errore Firestore addService: $e');
      _services.add(service);
      notifyListeners();
      return false;
    }
  }

  /// Modifica un servizio esistente su Cloud Firestore e nello stato locale
  Future<bool> updateService(SalonService service, {required String salonId}) async {
    try {
      await FirebaseFirestore.instance
          .collection('saloni')
          .doc(salonId)
          .collection('servizi')
          .doc(service.id)
          .set(service.toJson(), SetOptions(merge: true));

      final idx = _services.indexWhere((s) => s.id == service.id);
      if (idx != -1) {
        _services[idx] = service;
        notifyListeners();
      }
      return true;
    } catch (e) {
      debugPrint('Errore Firestore updateService: $e');
      final idx = _services.indexWhere((s) => s.id == service.id);
      if (idx != -1) {
        _services[idx] = service;
        notifyListeners();
      }
      return false;
    }
  }

  /// Elimina un servizio da Cloud Firestore e dallo stato locale
  Future<bool> deleteService(String serviceId, {required String salonId}) async {
    try {
      await FirebaseFirestore.instance
          .collection('saloni')
          .doc(salonId)
          .collection('servizi')
          .doc(serviceId)
          .delete();

      _services.removeWhere((s) => s.id == serviceId);
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Errore Firestore deleteService: $e');
      _services.removeWhere((s) => s.id == serviceId);
      notifyListeners();
      return false;
    }
  }

  void _mergeOrUpdateSalon(String id, Map<String, dynamic> data) {
    // Escludi saloni demo non esistenti
    if (id == 'salon-1' || id == 'salon-2' || id == 'salon-3' || id == '550e8400-e29b-41d4-a716-446655440000') {
      return;
    }

    final name = (data['salonName'] as String? ?? data['name'] as String? ?? '').trim();
    if (name.isEmpty || name.toLowerCase().contains('demo')) return;

    final salon = Salon(
      id: id,
      name: name,
      city: data['city'] as String? ?? 'Civitanova Marche',
      address: data['address'] as String? ?? 'Indirizzo Salone',
      category: data['category'] as String? ?? 'Barber Shop & Hair Salon',
      phone: data['phone'] as String? ?? '+39 0733 123456',
      imageUrl: data['imageUrl'] as String? ??
          data['photoUrl'] as String? ??
          'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600&auto=format&fit=crop&q=80',
      rating: (data['rating'] as num?)?.toDouble() ?? 5.0,
      reviewCount: (data['reviewCount'] as num?)?.toInt() ?? 1,
      minPrice: (data['minPrice'] as num?)?.toDouble() ?? 25.0,
      lookbook: (data['lookbook'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [
        data['imageUrl'] as String? ??
            data['photoUrl'] as String? ??
            'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600&auto=format&fit=crop&q=80',
      ],
      latitude: (data['latitude'] as num?)?.toDouble() ?? 43.3073,
      longitude: (data['longitude'] as num?)?.toDouble() ?? 13.7214,
    );

    final idx = _salons.indexWhere((s) => s.id == salon.id || s.name.toLowerCase() == salon.name.toLowerCase());
    if (idx != -1) {
      _salons[idx] = salon;
    } else {
      _salons.add(salon);
    }
  }

  Salon? getSalonById(String id) {
    try {
      return _salons.firstWhere((s) => s.id == id);
    } catch (_) {
      return _salons.isNotEmpty ? _salons.first : null;
    }
  }

  /// Salva e aggiorna i dati e l'immagine profilo del salone su Cloud Firestore
  Future<bool> saveSalonProfile({
    required String salonId,
    required String name,
    required String category,
    required String address,
    required String city,
    required String phone,
    required String imageUrl,
  }) async {
    try {
      final docData = <String, dynamic>{
        'id': salonId,
        'uid': salonId,
        'name': name.trim(),
        'salonName': name.trim(),
        'category': category.trim(),
        'address': address.trim(),
        'city': city.trim(),
        'phone': phone.trim(),
        'imageUrl': imageUrl.trim(),
        'photoUrl': imageUrl.trim(),
        'updatedAt': FieldValue.serverTimestamp(),
      };

      // 1. Salva in /saloni/{salonId}
      await FirebaseFirestore.instance
          .collection('saloni')
          .doc(salonId)
          .set(docData, SetOptions(merge: true));

      // 2. Salva in /users/{salonId}
      await FirebaseFirestore.instance
          .collection('users')
          .doc(salonId)
          .set(docData, SetOptions(merge: true));

      _mergeOrUpdateSalon(salonId, docData);
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Errore salvataggio profilo salone su Firestore: $e');
      return false;
    }
  }

  /// Ricerca e filtra i saloni per testo, categoria, città e ordinamento per vicinanza GPS
  List<Salon> searchSalons(
    String query, 
    String category, {
    double? userLat, 
    double? userLng,
    String? cityFilter,
  }) {
    final list = _salons.where((s) {
      final matchesQuery = query.isEmpty ||
          s.name.toLowerCase().contains(query.toLowerCase()) ||
          s.city.toLowerCase().contains(query.toLowerCase()) ||
          s.address.toLowerCase().contains(query.toLowerCase()) ||
          s.category.toLowerCase().contains(query.toLowerCase());
      final matchesCat = category == 'Tutti' || s.category.toLowerCase().contains(category.toLowerCase());
      final matchesCity = cityFilter == null || 
          cityFilter == 'Tutte' || 
          cityFilter.startsWith('Vicino') || 
          s.city.toLowerCase() == cityFilter.toLowerCase();
      return matchesQuery && matchesCat && matchesCity;
    }).toList();

    // Se le coordinate utente sono presenti, ordina per vicinanza (distanza crescente)
    if (userLat != null && userLng != null) {
      list.sort((a, b) {
        if (a.latitude == null || a.longitude == null) return 1;
        if (b.latitude == null || b.longitude == null) return -1;
        final distA = (a.latitude! - userLat) * (a.latitude! - userLat) +
            (a.longitude! - userLng) * (a.longitude! - userLng);
        final distB = (b.latitude! - userLat) * (b.latitude! - userLat) +
            (b.longitude! - userLng) * (b.longitude! - userLng);
        return distA.compareTo(distB);
      });
    }

    return list;
  }
}
