class SalonService {
  final String id;
  final String name;
  final String category;
  final double price;
  final int durationMinutes;
  final String description;

  const SalonService({
    required this.id,
    required this.name,
    required this.category,
    required this.price,
    required this.durationMinutes,
    required this.description,
  });

  factory SalonService.fromJson(Map<String, dynamic> json) {
    return SalonService(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Trattamento',
      category: json['category'] as String? ?? 'Taglio',
      price: (json['price'] as num?)?.toDouble() ?? 30.0,
      durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 30,
      description: json['description'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'category': category,
      'price': price,
      'durationMinutes': durationMinutes,
      'description': description,
    };
  }
}
