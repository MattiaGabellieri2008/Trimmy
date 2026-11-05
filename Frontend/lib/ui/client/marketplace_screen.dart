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

  final List<String> _keywordSuggestions = [
    'Civitanova Marche',
    'Barber Shop',
    'Hair Stylist',
    'Taglio',
    'Colore',
    'Trattamenti',
    'Milano',
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
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: locationService.isGpsActive ? AppColors.emerald.withOpacity(0.15) : AppColors.zinc100,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.my_location,
                      color: locationService.isGpsActive ? AppColors.emerald : AppColors.zinc700,
                      size: 20,
                    ),
                  ),
                  title: const Text('Posizione GPS Attuale', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  subtitle: Text(
                    locationService.isGpsActive
                        ? 'Attiva (${locationService.currentCity ?? "Rilevata"})'
                        : 'Tocca per attivare geolocalizzazione automatica',
                    style: const TextStyle(fontSize: 12, color: AppColors.zinc500),
                  ),
                  trailing: locationService.isGpsActive
                      ? const Icon(Icons.check_circle, color: AppColors.emerald, size: 20)
                      : null,
                  onTap: () async {
                    Navigator.pop(ctx);
                    await _handleGpsRequest(context, locationService);
                  },
                ),
                const Divider(height: 24),
                const Text(
                  'Oppure seleziona una città:',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.zinc700),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: locationService.presetCities.map((city) {
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final salons = salonRepo.searchSalons(
      _searchQuery,
      _selectedCategory,
      userLat: locationService.currentLocation?.latitude,
      userLng: locationService.currentLocation?.longitude,
      cityFilter: locationService.selectedCity,
    );

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : AppColors.zinc50,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: isDark ? AppColors.gold : AppColors.obsidianBlack,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(Icons.content_cut, color: isDark ? AppColors.obsidianBlack : AppColors.white, size: 16),
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
                color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: isDark ? const Color(0xFF3A3A3A) : AppColors.zinc200),
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
                        color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            locationService.isGpsActive ? Icons.near_me : Icons.location_on,
                            size: 15,
                            color: locationService.isGpsActive ? AppColors.emerald : AppColors.gold,
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              locationService.selectedCity,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: isDark ? Colors.white : AppColors.zinc900,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Icon(Icons.keyboard_arrow_down, size: 16, color: isDark ? Colors.white54 : AppColors.zinc400),
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
                    backgroundColor: locationService.isGpsActive
                        ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                        : (isDark ? const Color(0xFF1E1E1E) : AppColors.white),
                    foregroundColor: locationService.isGpsActive
                        ? (isDark ? AppColors.obsidianBlack : AppColors.white)
                        : (isDark ? Colors.white : AppColors.zinc700),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
                    ),
                  ),
                  icon: locationService.isLocating
                      ? SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: isDark ? AppColors.gold : AppColors.zinc700,
                          ),
                        )
                      : const Icon(Icons.my_location, size: 18),
                ),
              ],
            ),
          ),

          // 1. Barra di Ricerca Intelligente
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 6),
            child: Container(
              height: 44,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  const Icon(Icons.search, color: AppColors.zinc400, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      onChanged: (val) => setState(() => _searchQuery = val.trim()),
                      style: TextStyle(fontSize: 13, color: isDark ? Colors.white : AppColors.zinc900),
                      decoration: const InputDecoration(
                        hintText: 'Cerca salone, via o trattamento...',
                        hintStyle: TextStyle(color: AppColors.zinc400, fontSize: 13),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                  if (_searchQuery.isNotEmpty)
                    GestureDetector(
                      onTap: () {
                        _searchController.clear();
                        setState(() => _searchQuery = '');
                      },
                      child: const Icon(Icons.close, size: 18, color: AppColors.zinc400),
                    ),
                ],
              ),
            ),
          ),

          // 2. Chip Consigli Parole Chiave per Ricerca Semplificata
          SizedBox(
            height: 32,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _keywordSuggestions.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (context, idx) {
                final kw = _keywordSuggestions[idx];
                final isKwActive = _searchQuery.toLowerCase() == kw.toLowerCase();
                return ActionChip(
                  label: Text(
                    '#$kw',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: isKwActive ? FontWeight.bold : FontWeight.w500,
                      color: isKwActive
                          ? AppColors.gold
                          : (isDark ? Colors.white70 : AppColors.zinc700),
                    ),
                  ),
                  backgroundColor: isKwActive
                      ? (isDark ? const Color(0xFF332915) : const Color(0xFFFEF3C7))
                      : (isDark ? const Color(0xFF1E1E1E) : AppColors.white),
                  side: BorderSide(
                    color: isKwActive
                        ? AppColors.gold
                        : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  visualDensity: VisualDensity.compact,
                  onPressed: () {
                    setState(() {
                      if (isKwActive) {
                        _searchController.clear();
                        _searchQuery = '';
                      } else {
                        _searchController.text = kw;
                        _searchQuery = kw;
                      }
                    });
                  },
                );
              },
            ),
          ),

          const SizedBox(height: 8),

          // 3. Chip Categorie Orizzontali
          SizedBox(
            height: 36,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final cat = _categories[index];
                final isSelected = _selectedCategory == cat;
                return ChoiceChip(
                  label: Text(
                    cat,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                      color: isSelected
                          ? (isDark ? AppColors.obsidianBlack : AppColors.white)
                          : (isDark ? Colors.white70 : AppColors.zinc700),
                    ),
                  ),
                  selected: isSelected,
                  selectedColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
                  backgroundColor: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(
                      color: isSelected
                          ? (isDark ? AppColors.gold : AppColors.obsidianBlack)
                          : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
                    ),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  onSelected: (_) => setState(() => _selectedCategory = cat),
                );
              },
            ),
          ),

          const SizedBox(height: 8),

          // 4. Lista Saloni Reali (con rating, foto e distanza GPS)
          Expanded(
            child: salons.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.storefront, color: isDark ? Colors.white30 : AppColors.zinc300, size: 48),
                          const SizedBox(height: 10),
                          Text(
                            _searchQuery.isNotEmpty
                                ? 'Nessun salone trovato per "$_searchQuery".'
                                : 'Nessun salone disponibile in questa categoria.',
                            style: TextStyle(
                              color: isDark ? Colors.white70 : AppColors.zinc700,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Prova a selezionare un\'altra categoria o cambiare città (${locationService.selectedCity}).',
                            style: TextStyle(color: isDark ? Colors.white54 : AppColors.zinc400, fontSize: 12),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
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
                        isDark: isDark,
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
  final bool isDark;
  final VoidCallback onBook;

  const _SalonCard({
    required this.salon,
    required this.distanceStr,
    required this.isDark,
    required this.onBook,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.3 : 0.03),
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
                    color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200,
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
                        color: isDark ? const Color(0xFF2A2A2A) : AppColors.white,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        salon.category,
                        style: TextStyle(
                          color: isDark ? Colors.white : AppColors.zinc900,
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
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : AppColors.zinc900,
                        ),
                      ),
                    ),
                    Text(
                      'da €${salon.minPrice.toInt()}',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        color: isDark ? AppColors.gold : AppColors.zinc900,
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
                        style: TextStyle(fontSize: 12, color: isDark ? Colors.white60 : AppColors.zinc500),
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
                      backgroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
                      foregroundColor: isDark ? AppColors.obsidianBlack : AppColors.white,
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
