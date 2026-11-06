import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/theme_repository.dart';
import '../../data/repositories/auth_repository.dart';
import '../../data/repositories/salon_repository.dart';
import 'services_catalog_screen.dart';
import 'analytics_screen.dart';

class SalonProfileScreen extends StatefulWidget {
  const SalonProfileScreen({super.key});

  @override
  State<SalonProfileScreen> createState() => _SalonProfileScreenState();
}

class _SalonProfileScreenState extends State<SalonProfileScreen> {
  bool _smsRemindersEnabled = true;
  bool _pushNotificationsEnabled = true;

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _smsRemindersEnabled = prefs.getBool('trimmy_salon_sms_reminders') ?? true;
      _pushNotificationsEnabled = prefs.getBool('trimmy_salon_push_notif') ?? true;
    });
  }

  Future<void> _toggleSmsReminders(bool value, String? salonId) async {
    setState(() => _smsRemindersEnabled = value);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('trimmy_salon_sms_reminders', value);

    if (salonId != null && salonId.isNotEmpty) {
      try {
        await FirebaseFirestore.instance
            .collection('saloni')
            .doc(salonId)
            .set({'smsRemindersEnabled': value}, SetOptions(merge: true));
      } catch (e) {
        debugPrint('Errore salvataggio opzione SMS su Firestore: $e');
      }
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            value
                ? 'Notifiche SMS promemoria attivate: i clienti riceveranno un SMS 24h prima dell\'appuntamento.'
                : 'Notifiche SMS promemoria disattivate.',
          ),
          backgroundColor: value ? AppColors.emeraldGreen : AppColors.zinc800,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authRepo = context.watch<AuthRepository>();
    final salonRepo = context.watch<SalonRepository>();
    final themeRepo = context.watch<ThemeRepository>();
    final isDark = themeRepo.isDarkMode(context);
    final user = authRepo.currentUser;
    final salonId = user?.salonId ?? user?.id ?? 'salone-default';

    final realSalon = salonRepo.getSalonById(salonId);
    final salonName = realSalon?.name ?? user?.salonName ?? user?.displayName ?? 'Salone Partner Trimmy';
    final salonCity = realSalon?.city ?? 'Civitanova Marche';
    final salonAddress = realSalon?.address ?? 'Indirizzo Salone';
    final salonCategory = realSalon?.category ?? 'Hair Stylist & Barber';
    final salonPhone = realSalon?.phone ?? '+39 0733 123456';
    final salonImageUrl = realSalon?.imageUrl ??
        'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600&auto=format&fit=crop&q=80';

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Gestione Salone & Profilo', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Card Profilo Salone Reale con Immagine
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(isDark ? 0.3 : 0.03),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: _buildSalonImageWidget(
                          salonImageUrl,
                          width: 68,
                          height: 68,
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              salonName,
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 17,
                                color: isDark ? Colors.white : AppColors.zinc900,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Row(
                              children: [
                                const Icon(Icons.location_on, size: 12, color: AppColors.gold),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    '$salonAddress, $salonCity',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: isDark ? Colors.white60 : AppColors.zinc500,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              salonPhone,
                              style: TextStyle(
                                fontSize: 11,
                                color: isDark ? Colors.white54 : AppColors.zinc400,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF332915) : Colors.amber.shade50,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: AppColors.gold.withOpacity(0.5)),
                              ),
                              child: Text(
                                'PIANO PRO CLOUD • $salonCategory',
                                style: const TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.gold,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  // Pulsante Modifica Profilo & Foto Salone
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => _showEditSalonModal(
                        context,
                        salonId: salonId,
                        initialName: salonName,
                        initialCategory: salonCategory,
                        initialAddress: salonAddress,
                        initialCity: salonCity,
                        initialPhone: salonPhone,
                        initialImageUrl: salonImageUrl,
                      ),
                      icon: const Icon(Icons.edit, size: 15, color: AppColors.gold),
                      label: const Text(
                        'Modifica Dati & Immagine Salone',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.gold),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.gold),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // SEZIONE IMPOSTAZIONI TEMA & NOTIFICHE
            Text(
              'Impostazioni & Notifiche',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white70 : AppColors.zinc700,
              ),
            ),
            const SizedBox(height: 10),

            // 1. Dark Mode Switch
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      isDark ? Icons.dark_mode : Icons.light_mode,
                      size: 20,
                      color: isDark ? AppColors.gold : AppColors.zinc800,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Tema Scuro (Dark Mode)',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: isDark ? Colors.white : AppColors.zinc900,
                          ),
                        ),
                        Text(
                          isDark ? 'Interfaccia scura attiva' : 'Interfaccia chiara attiva',
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark ? Colors.white60 : AppColors.zinc500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Switch.adaptive(
                    value: isDark,
                    activeColor: AppColors.gold,
                    onChanged: (val) {
                      themeRepo.toggleDarkMode(val);
                    },
                  ),
                ],
              ),
            ),

            const SizedBox(height: 10),

            // 2. Notifiche SMS Switch Funzionante
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.sms_outlined, size: 20, color: AppColors.emeraldGreen),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Notifiche SMS Promemoria Clienti',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: isDark ? Colors.white : AppColors.zinc900,
                          ),
                        ),
                        Text(
                          'Invia promemoria automatici via SMS 24h prima dell\'appuntamento',
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark ? Colors.white60 : AppColors.zinc500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Switch.adaptive(
                    value: _smsRemindersEnabled,
                    activeColor: AppColors.emeraldGreen,
                    onChanged: (val) => _toggleSmsReminders(val, salonId),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 10),

            // 3. Notifiche Push Salone
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.notifications_active_outlined, size: 20, color: isDark ? Colors.amber : AppColors.zinc800),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Notifiche Push Nuove Prenotazioni',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: isDark ? Colors.white : AppColors.zinc900,
                          ),
                        ),
                        Text(
                          'Avvisi sonori istantanei quando un cliente prenota',
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark ? Colors.white60 : AppColors.zinc500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Switch.adaptive(
                    value: _pushNotificationsEnabled,
                    activeColor: AppColors.gold,
                    onChanged: (val) async {
                      setState(() => _pushNotificationsEnabled = val);
                      final prefs = await SharedPreferences.getInstance();
                      await prefs.setBool('trimmy_salon_push_notif', val);
                    },
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Moduli di Gestione Avanzata
            Text(
              'Moduli Gestionali',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white70 : AppColors.zinc700,
              ),
            ),
            const SizedBox(height: 10),

            _buildActionTile(
              context: context,
              isDark: isDark,
              icon: Icons.content_cut,
              title: 'Listino Prezzi & Servizi',
              subtitle: 'Gestione completa con Modifica ed Elimina trattamenti',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ServicesCatalogScreen()),
                );
              },
            ),
            const SizedBox(height: 8),
            _buildActionTile(
              context: context,
              isDark: isDark,
              icon: Icons.insights,
              title: 'Statistiche, Incassi & KPI',
              subtitle: 'Fatturato in tempo reale, scontrino medio e trend',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AnalyticsScreen()),
                );
              },
            ),

            const SizedBox(height: 20),

            // Informazioni e Sincronizzazione Cloud
            Text(
              'Infrastruttura & Sicurezza Cloud',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white70 : AppColors.zinc700,
              ),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      const Icon(Icons.cloud_done_outlined, size: 22, color: AppColors.emeraldGreen),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Google Cloud & Firebase Connessi',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                                color: isDark ? Colors.white : AppColors.zinc900,
                              ),
                            ),
                            Text(
                              'Database Firestore e Cloud SQL sincronizzati in tempo reale per agenda, clienti e listino.',
                              style: TextStyle(
                                fontSize: 11,
                                color: isDark ? Colors.white60 : AppColors.zinc500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 28),

            // Pulsante Logout
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _confirmSignOut(context, authRepo),
                icon: const Icon(Icons.logout, size: 18, color: Colors.red),
                label: const Text('Esci dall\'Account Salone', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: Colors.red.shade300),
                  backgroundColor: Colors.red.withOpacity(0.08),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Pulsante Eliminazione Account GDPR (Art. 17)
            Center(
              child: TextButton.icon(
                onPressed: () => _confirmDeleteAccount(context, authRepo),
                icon: Icon(Icons.delete_forever_outlined, size: 16, color: isDark ? Colors.white54 : AppColors.zinc500),
                label: Text(
                  'Elimina Account e Dati Personali (GDPR)',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.white54 : AppColors.zinc500,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionTile({
    required BuildContext context,
    required bool isDark,
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
      ),
      child: ListTile(
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, size: 20, color: isDark ? AppColors.gold : AppColors.zinc800),
        ),
        title: Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 13,
            color: isDark ? Colors.white : AppColors.zinc900,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: TextStyle(
            fontSize: 11,
            color: isDark ? Colors.white60 : AppColors.zinc500,
          ),
        ),
        trailing: Icon(Icons.arrow_forward_ios, size: 14, color: isDark ? Colors.white38 : AppColors.zinc400),
      ),
    );
  }

  Widget _buildSalonImageWidget(
    String imageUrl, {
    double? width,
    double? height,
    BoxFit fit = BoxFit.cover,
  }) {
    if (imageUrl.startsWith('data:image')) {
      try {
        final base64Str = imageUrl.contains(',') ? imageUrl.split(',').last : imageUrl;
        final bytes = base64Decode(base64Str);
        return Image.memory(
          bytes,
          width: width,
          height: height,
          fit: fit,
          errorBuilder: (_, __, ___) => _imageFallback(width, height),
        );
      } catch (_) {
        return _imageFallback(width, height);
      }
    }

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return Image.network(
        imageUrl,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, __, ___) => _imageFallback(width, height),
      );
    }

    return _imageFallback(width, height);
  }

  Widget _imageFallback(double? width, double? height) {
    return Container(
      width: width,
      height: height,
      color: AppColors.obsidianBlack,
      child: const Icon(Icons.storefront, color: AppColors.gold, size: 32),
    );
  }

  void _showEditSalonModal(
    BuildContext context, {
    required String salonId,
    required String initialName,
    required String initialCategory,
    required String initialAddress,
    required String initialCity,
    required String initialPhone,
    required String initialImageUrl,
  }) {
    final nameCtrl = TextEditingController(text: initialName);
    final addressCtrl = TextEditingController(text: initialAddress);
    final cityCtrl = TextEditingController(text: initialCity);
    final phoneCtrl = TextEditingController(text: initialPhone);

    final availableCategories = [
      'Barber Shop',
      'Hair Stylist Donna',
      'Hair Stylist Uomo & Donna',
      'Barber Shop & Hair Salon',
      'Centro Estetico',
      'Unisex',
      'SPA & Benessere',
      'Nail Salon & Manicure',
    ];

    if (initialCategory.trim().isNotEmpty && !availableCategories.contains(initialCategory.trim())) {
      availableCategories.insert(0, initialCategory.trim());
    }

    String selectedCategory = availableCategories.contains(initialCategory.trim())
        ? initialCategory.trim()
        : availableCategories.first;

    String currentImageUrl = initialImageUrl;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.storefront, color: AppColors.gold, size: 24),
                        const SizedBox(width: 8),
                        Text(
                          'Modifica Dati & Foto Salone',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 17,
                            color: isDark ? Colors.white : AppColors.zinc900,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Anteprima Immagine e Pulsante Caricamento File da Locale
                    Center(
                      child: Column(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(16),
                            child: _buildSalonImageWidget(
                              currentImageUrl,
                              width: 140,
                              height: 90,
                              fit: BoxFit.cover,
                            ),
                          ),
                          const SizedBox(height: 10),
                          OutlinedButton.icon(
                            onPressed: () async {
                              try {
                                final picker = ImagePicker();
                                final XFile? file = await picker.pickImage(
                                  source: ImageSource.gallery,
                                  maxWidth: 800,
                                  maxHeight: 800,
                                  imageQuality: 75,
                                );
                                if (file != null) {
                                  final bytes = await file.readAsBytes();
                                  final base64Image = 'data:image/jpeg;base64,${base64Encode(bytes)}';
                                  setModalState(() {
                                    currentImageUrl = base64Image;
                                  });
                                }
                              } catch (e) {
                                debugPrint('Errore selezione file immagine: $e');
                              }
                            },
                            icon: const Icon(Icons.file_upload_outlined, size: 18),
                            label: const Text(
                              'Importa Immagine da Locale',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: AppColors.gold, width: 1.5),
                              foregroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    TextField(
                      controller: nameCtrl,
                      decoration: const InputDecoration(labelText: 'Nome del Salone (visibile ai clienti)'),
                    ),
                    const SizedBox(height: 10),

                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: selectedCategory,
                            decoration: const InputDecoration(
                              labelText: 'Categoria',
                            ),
                            isExpanded: true,
                            items: availableCategories.map((cat) {
                              return DropdownMenuItem<String>(
                                value: cat,
                                child: Text(cat, style: const TextStyle(fontSize: 13), overflow: TextOverflow.ellipsis),
                              );
                            }).toList(),
                            onChanged: (val) {
                              if (val != null) {
                                setModalState(() => selectedCategory = val);
                              }
                            },
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: cityCtrl,
                            decoration: const InputDecoration(labelText: 'Città (es. Civitanova Marche)'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    TextField(
                      controller: addressCtrl,
                      decoration: const InputDecoration(labelText: 'Indirizzo e Numero Civico'),
                    ),
                    const SizedBox(height: 10),

                    TextField(
                      controller: phoneCtrl,
                      decoration: const InputDecoration(labelText: 'Telefono di Contatto / WhatsApp'),
                    ),

                    const SizedBox(height: 20),

                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () async {
                          final name = nameCtrl.text.trim();
                          if (name.isEmpty) return;

                          final salonRepo = context.read<SalonRepository>();
                          final authRepo = context.read<AuthRepository>();

                          final ok = await salonRepo.saveSalonProfile(
                            salonId: salonId,
                            name: name,
                            category: selectedCategory,
                            address: addressCtrl.text.trim(),
                            city: cityCtrl.text.trim(),
                            phone: phoneCtrl.text.trim(),
                            imageUrl: currentImageUrl,
                          );

                          authRepo.updateSalonData(
                            salonName: name,
                            category: selectedCategory,
                            city: cityCtrl.text.trim(),
                            address: addressCtrl.text.trim(),
                            phone: phoneCtrl.text.trim(),
                            imageUrl: currentImageUrl,
                          );

                          if (ctx.mounted) Navigator.pop(ctx);

                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(ok
                                    ? 'Dati e immagine del salone aggiornati nel Cloud!'
                                    : 'Errore durante l\'aggiornamento.'),
                                backgroundColor: ok ? AppColors.emeraldGreen : Colors.red,
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
                          foregroundColor: isDark ? AppColors.obsidianBlack : AppColors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Salva Informazioni Salone', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _confirmSignOut(BuildContext context, AuthRepository authRepo) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Disconnetti Salone'),
        content: const Text('Vuoi davvero uscire? Verrai reindirizzato alla schermata di accesso.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annulla', style: TextStyle(color: AppColors.zinc600)),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              authRepo.signOut();
            },
            child: const Text('Esci', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteAccount(BuildContext context, AuthRepository authRepo) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.red, size: 24),
            SizedBox(width: 8),
            Text('Elimina Salone e Account', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
        content: const Text(
          'Questa operazione è permanente e non reversibile (GDPR Art. 17).\n\n'
          'Verranno eliminati definitivamente l\'account di gestione, i dati del profilo e l\'anagrafica del salone dai server Cloud.',
          style: TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annulla', style: TextStyle(color: AppColors.zinc600)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await authRepo.deleteAccount();
              if (!success && context.mounted) {
                final errMsg = authRepo.errorMessage ?? 'Impossibile eliminare l\'account.';
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(errMsg), backgroundColor: Colors.red),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Elimina Definitivamente', style: TextStyle(color: AppColors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
