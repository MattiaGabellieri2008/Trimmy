import 'package:flutter/foundation.dart';
import '../models/salon_model.dart';
import '../models/service_model.dart';

class SalonRepository extends ChangeNotifier {
  final List<Salon> _salons = [
    const Salon(
      id: 'salon-1',
      name: 'Atelier Bellezza Duomo',
      city: 'Milano',
      address: 'Piazza del Duomo, 12',
      rating: 4.95,
      reviewCount: 128,
      minPrice: 28.0,
      category: 'Hair Stylist Donna',
      imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=700&auto=format&fit=crop&q=80',
      phone: '+39 02 8847291',
      lookbook: [
        'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=700&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=700&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=700&auto=format&fit=crop&q=80',
      ],
    ),
    const Salon(
      id: 'salon-2',
      name: 'The Barber Club Brera',
      city: 'Milano',
      address: 'Via Brera, 24',
      rating: 4.90,
      reviewCount: 94,
      minPrice: 22.0,
      category: 'Barber Shop',
      imageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=700&auto=format&fit=crop&q=80',
      phone: '+39 02 9182736',
      lookbook: [
        'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=700&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=700&auto=format&fit=crop&q=80',
      ],
    ),
    const Salon(
      id: 'salon-3',
      name: 'Luxe Hair & Spa Navigli',
      city: 'Milano',
      address: 'Ripa di Porta Ticinese, 45',
      rating: 4.88,
      reviewCount: 67,
      minPrice: 35.0,
      category: 'Unisex',
      imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=700&auto=format&fit=crop&q=80',
      phone: '+39 02 7483921',
      lookbook: [
        'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=700&auto=format&fit=crop&q=80',
      ],
    ),
  ];

  final List<SalonService> _services = [
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

  List<Salon> get salons => _salons;
  List<SalonService> get services => _services;

  Salon? getSalonById(String id) {
    try {
      return _salons.firstWhere((s) => s.id == id);
    } catch (_) {
      return _salons.isNotEmpty ? _salons.first : null;
    }
  }

  List<Salon> searchSalons(String query, String category) {
    return _salons.where((s) {
      final matchesQuery = query.isEmpty ||
          s.name.toLowerCase().contains(query.toLowerCase()) ||
          s.city.toLowerCase().contains(query.toLowerCase());
      final matchesCat = category == 'Tutti' || s.category == category;
      return matchesQuery && matchesCat;
    }).toList();
  }
}
