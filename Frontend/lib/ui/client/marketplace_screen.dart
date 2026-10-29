import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/location_service.dart';
import '../../data/models/salon_model.dart';
import '../../data/repositories/salon_repository.dart';
import 'booking_wizard_screen.dart';

class MarketplaceScreen extends StatefulWidget {
  const MarketplaceScreen({super.key});

  @override
  State<MarketplaceScreen> createState() => _MarketplaceScreenState();
}

class _MarketplaceScreenState extends State<MarketplaceScreen> {
  String _selectedCategory = 'Tutti';
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  final List<String> _categories = [
    'Tutti',
    'Hair Stylist Donna',
    'Barber Shop',
    'Unisex',
    'Centro Estetico',
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _handleGpsRequest(BuildContext context, LocationService locationService) async {
    final result = await locationService.requestLocation();
    if (!mounted) return;

    if (result == LocationPermissionResult.granted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              Icon(Icons.check_circle, color: AppColors.emerald, size: 18),
              SizedBox(width: 8),
              Expanded(
                child: Text('Posizione GPS rilevata! Saloni ordinati per vicinanza.'),
              ),
            ],
          ),
          backgroundColor: AppColors.obsidianBlack,
          behavior: SnackBarBehavior.floating,
          duration: Duration(seconds: 3),
        ),
      );
    } else if (result == LocationPermissionResult.denied) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(locationService.lastErrorMessage ?? 'Permesso GPS negato. Puoi selezionare una città manualmente.'),
          action: SnackBarAction(
            label: 'OK',
            textColor: AppColors.white,
            onPressed: () {},
          ),
          backgroundColor: AppColors.zinc800,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else if (result == LocationPermissionResult.deniedForever) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.location_off, color: AppColors.rose, size: 22),
              SizedBox(width: 8),
              Text('Permesso Posizione', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          content: const Text(
            'L\'accesso alla posizione GPS è disattivato permanentemente nelle impostazioni del telefono. Per visualizzare i saloni nelle tue vicinanze, concedi il permesso da Impostazioni.',
            style: TextStyle(fontSize: 13, height: 1.4),
          ),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Annulla', style: TextStyle(color: AppColors.zinc500)),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                locationService.openSettings();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.obsidianBlack,
                foregroundColor: AppColors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('Apri Impostazioni'),
            ),
          ],
        ),
      );
    } else if (result == LocationPermissionResult.serviceDisabled) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('I servizi di localizzazione (GPS) sono spenti. Attivali nelle impostazioni rapide del telefono.'),
          backgroundColor: AppColors.zinc800,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _showCityPickerSheet(BuildContext context, LocationService locationService) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.zinc300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Seleziona la tua Posizione',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.zinc900),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Scegli se usare il GPS in tempo reale o impostare una città specifica.',
                  style: TextStyle(fontSize: 12, color: AppColors.zinc500),
                ),
                const SizedBox(height: 16),

                // Pulsante GPS
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: locationService.isGpsActive ? AppColors.obsidianBlack : AppColors.zinc100,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.my_location,
                      color: locationService.isGpsActive ? AppColors.white : AppColors.zinc700,
                      size: 20,
                    ),
                  ),
                  title: const Text(
                    'Usa la mia posizione attuale (GPS)',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  subtitle: Text(
                    locationService.isGpsActive ? 'Attivo — Saloni ordinati per distanza' : 'Richiede autorizzazione GPS runtime',
                    style: TextStyle(fontSize: 11, color: locationService.isGpsActive ? AppColors.emerald : AppColors.zinc400),
                  ),
                  trailing: locationService.isLocating
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.obsidianBlack),
                        )
                      : null,
                  onTap: () {
                    Navigator.pop(ctx);
                    _handleGpsRequest(context, locationService);
                  },
                ),

                const Divider(height: 24),
                const Text(
                  'Oppure seleziona una città:',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.zinc400),
                ),
                const SizedBox(height: 8),

                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: LocationService.cityPresets.keys.map((city) {
                    final isCurrent = !locationService.isGpsActive && locationService.selectedCity == city;
                    return ChoiceChip(
                      label: Text(city),
                      selected: isCurrent,
                      selectedColor: AppColors.obsidianBlack,
                      labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                        color: isCurrent ? AppColors.white : AppColors.zinc700,
                      ),
                      backgroundColor: AppColors.zinc50,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(color: isCurrent ? AppColors.obsidianBlack : AppColors.zinc200),
                      ),
                      onSelected: (selected) {
                        if (selected) {
                          locationService.setCity(city);
                          Navigator.pop(ctx);
                        }
                      },
                    );
                  }).toList(),
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final salonRepo = context.watch<SalonRepository>();
    final locationService = context.watch<LocationService>();

    final salons = salonRepo.searchSalons(
      _searchQuery,
      _selectedCategory,
      userLat: locationService.currentLocation?.latitude,
      userLng: locationService.currentLocation?.longitude,
      cityFilter: locationService.selectedCity,
    );

    return Scaffold(
      backgroundColor: AppColors.zinc50,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.obsidianBlack,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.content_cut, color: AppColors.white, size: 16),
            ),
            const SizedBox(width: 8),
            const Text(
              'Trimmy.',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.zinc100,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.zinc200),
              ),
              child: const Text(
                'DISCOVER',
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.5),
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // 0. Location Bar & GPS Status Selector
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => _showCityPickerSheet(context, locationService),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.zinc200),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            locationService.isGpsActive ? Icons.near_me : Icons.location_on,
                            size: 15,
                            color: locationService.isGpsActive ? AppColors.emerald : AppColors.zinc700,
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              locationService.selectedCity,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: AppColors.zinc900,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const Icon(Icons.keyboard_arrow_down, size: 16, color: AppColors.zinc400),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  tooltip: 'Aggiorna posizione GPS',
                  onPressed: locationService.isLocating ? null : () => _handleGpsRequest(context, locationService),
                  style: IconButton.styleFrom(
                    backgroundColor: locationService.isGpsActive ? AppColors.obsidianBlack : AppColors.white,
                    foregroundColor: locationService.isGpsActive ? AppColors.white : AppColors.zinc700,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: AppColors.zinc200),
                    ),
                  ),
                  icon: locationService.isLocating
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.zinc700),
                        )
                      : const Icon(Icons.my_location, size: 18),
                ),
              ],
            ),
          ),

          // 1. Barra di Ricerca
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.zinc200),
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (val) => setState(() => _searchQuery = val),
                decoration: const InputDecoration(
                  hintText: 'Cerca per nome salone o via...',
                  hintStyle: TextStyle(color: AppColors.zinc400, fontSize: 13),
                  prefixIcon: Icon(Icons.search, color: AppColors.zinc400, size: 20),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
            ),
          ),

          // 2. Chip Categorie Orizzontali
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final cat = _categories[index];
                final isSelected = _selectedCategory == cat;
                return GestureDetector(
                  onTap: () => setState(() => _selectedCategory = cat),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.obsidianBlack : AppColors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected ? AppColors.obsidianBlack : AppColors.zinc200,
                      ),
                    ),
                    child: Center(
                      child: Text(
                        cat,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                          color: isSelected ? AppColors.white : AppColors.zinc700,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 12),

          // 3. Lista Saloni (Card Stile Airbnb / Treatwell con badge distanza GPS)
          Expanded(
            child: salons.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.storefront, color: AppColors.zinc300, size: 48),
                        const SizedBox(height: 8),
                        const Text(
                          'Nessun salone trovato.',
                          style: TextStyle(color: AppColors.zinc500, fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Prova a cambiare categoria o zona (${locationService.selectedCity}).',
                          style: const TextStyle(color: AppColors.zinc400, fontSize: 11),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: salons.length,
                    itemBuilder: (context, index) {
                      final salon = salons[index];
                      final distanceStr = locationService.formatDistance(salon.latitude, salon.longitude);
                      return _SalonCard(
                        salon: salon,
                        distanceStr: distanceStr,
                        onBook: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => BookingWizardScreen(salon: salon),
                            ),
                          );
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _SalonCard extends StatelessWidget {
  final Salon salon;
  final String distanceStr;
  final VoidCallback onBook;

  const _SalonCard({
    required this.salon,
    required this.distanceStr,
    required this.onBook,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.zinc200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Foto Copertina & Tag Rating
          Stack(
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                child: Image.network(
                  salon.imageUrl,
                  height: 170,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    height: 170,
                    color: AppColors.zinc200,
                    child: const Icon(Icons.storefront, color: AppColors.zinc400, size: 48),
                  ),
                ),
              ),
              Positioned(
                top: 12,
                right: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.7),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.star, color: AppColors.goldLight, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        salon.rating.toStringAsFixed(1),
                        style: const TextStyle(
                          color: AppColors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                      Text(
                        ' (${salon.reviewCount})',
                        style: TextStyle(
                          color: AppColors.white.withOpacity(0.8),
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Positioned(
                bottom: 12,
                left: 12,
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        salon.category,
                        style: const TextStyle(
                          color: AppColors.zinc900,
                          fontWeight: FontWeight.bold,
                          fontSize: 10,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                    if (distanceStr.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.obsidianBlack.withOpacity(0.85),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.near_me, size: 10, color: AppColors.emerald),
                            const SizedBox(width: 3),
                            Text(
                              distanceStr,
                              style: const TextStyle(
                                color: AppColors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 10,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),

          // Informazioni Salone & Tasto Prenota
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        salon.name,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppColors.zinc900,
                        ),
                      ),
                    ),
                    Text(
                      'da €${salon.minPrice.toInt()}',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        color: AppColors.zinc900,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined, size: 14, color: AppColors.zinc400),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        '${salon.address}, ${salon.city}',
                        style: const TextStyle(fontSize: 12, color: AppColors.zinc500),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: onBook,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.obsidianBlack,
                      foregroundColor: AppColors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: const Text('Prenota Trattamento', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
