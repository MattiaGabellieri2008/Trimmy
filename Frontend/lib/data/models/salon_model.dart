class Salon {
  final String id;
  final String name;
  final String city;
  final String address;
  final double rating;
  final int reviewCount;
  final double minPrice;
  final String category;
  final String imageUrl;
  final String phone;
  final List<String> lookbook;
  final double? latitude;
  final double? longitude;

  const Salon({
    required this.id,
    required this.name,
    required this.city,
    required this.address,
    required this.rating,
    required this.reviewCount,
    required this.minPrice,
    required this.category,
    required this.imageUrl,
    required this.phone,
    this.lookbook = const [],
    this.latitude,
    this.longitude,
  });

  factory Salon.fromJson(Map<String, dynamic> json) {
    return Salon(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Salone',
      city: json['city'] as String? ?? 'Milano',
      address: json['address'] as String? ?? '',
      rating: (json['rating'] as num?)?.toDouble() ?? 4.9,
      reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 42,
      minPrice: (json['minPrice'] as num?)?.toDouble() ?? 25.0,
      category: json['category'] as String? ?? 'Barber Shop',
      imageUrl: json['imageUrl'] as String? ?? 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600&auto=format&fit=crop&q=80',
      phone: json['phone'] as String? ?? '+39 02 8847291',
      lookbook: (json['lookbook'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'city': city,
      'address': address,
      'rating': rating,
      'reviewCount': reviewCount,
      'minPrice': minPrice,
      'category': category,
      'imageUrl': imageUrl,
      'phone': phone,
      'lookbook': lookbook,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
    };
  }
}
