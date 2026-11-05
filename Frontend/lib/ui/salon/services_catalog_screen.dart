import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/service_model.dart';
import '../../data/repositories/auth_repository.dart';
import '../../data/repositories/salon_repository.dart';

class ServicesCatalogScreen extends StatefulWidget {
  const ServicesCatalogScreen({super.key});

  @override
  State<ServicesCatalogScreen> createState() => _ServicesCatalogScreenState();
}

class _ServicesCatalogScreenState extends State<ServicesCatalogScreen> {
  String _selectedCategory = 'Tutti';
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  final List<String> _categories = [
    'Tutti',
    'Taglio & Piega',
    'Colore',
    'Curativi',
    'Barba',
    'Estetica',
  ];

  final List<String> _keywordSuggestions = [
    'Taglio',
    'Piega',
    'Colore',
    'Balayage',
    'Barba',
    'Shampoo',
    'Trattamento',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authRepo = context.read<AuthRepository>();
      final salonId = authRepo.currentUser?.salonId ?? authRepo.currentUser?.id ?? 'salone-default';
      context.read<SalonRepository>().syncSalonServices(salonId);
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final salonRepo = context.watch<SalonRepository>();
    final authRepo = context.watch<AuthRepository>();
    final salonId = authRepo.currentUser?.salonId ?? authRepo.currentUser?.id ?? 'salone-default';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final services = salonRepo.services.where((s) {
      final matchesCat = _selectedCategory == 'Tutti' ||
          s.category.toLowerCase().contains(_selectedCategory.toLowerCase());
      final matchesSearch = _searchQuery.isEmpty ||
          s.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          s.description.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          s.category.toLowerCase().contains(_searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    }).toList();

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Listino Prezzi & Servizi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        elevation: 0,
      ),
      body: Column(
        children: [
          // 1. Barra di Ricerca Intelligente
          Container(
            color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Container(
              height: 42,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isDark ? const Color(0xFF3A3A3A) : AppColors.zinc200),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  const Icon(Icons.search, size: 20, color: AppColors.zinc400),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _searchCtrl,
                      onChanged: (val) => setState(() => _searchQuery = val.trim()),
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark ? Colors.white : AppColors.zinc900,
                      ),
                      decoration: const InputDecoration(
                        hintText: 'Cerca per nome servizio o parola chiave...',
                        hintStyle: TextStyle(fontSize: 12, color: AppColors.zinc400),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                  if (_searchQuery.isNotEmpty)
                    GestureDetector(
                      onTap: () {
                        _searchCtrl.clear();
                        setState(() => _searchQuery = '');
                      },
                      child: const Icon(Icons.close, size: 18, color: AppColors.zinc400),
                    ),
                ],
              ),
            ),
          ),

          // 2. Chip Consigli Parole Chiave
          Container(
            color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: SizedBox(
              height: 30,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
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
                        : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100),
                    side: BorderSide(
                      color: isKwActive
                          ? AppColors.gold
                          : (isDark ? const Color(0xFF3A3A3A) : AppColors.zinc200),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    visualDensity: VisualDensity.compact,
                    onPressed: () {
                      setState(() {
                        if (isKwActive) {
                          _searchCtrl.clear();
                          _searchQuery = '';
                        } else {
                          _searchCtrl.text = kw;
                          _searchQuery = kw;
                        }
                      });
                    },
                  );
                },
              ),
            ),
          ),

          // 3. Filtri Categorie Orizzontali
          Container(
            color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: SizedBox(
              height: 34,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _categories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, idx) {
                  final cat = _categories[idx];
                  final isSelected = _selectedCategory == cat;
                  return ChoiceChip(
                    label: Text(
                      cat,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        color: isSelected
                            ? AppColors.white
                            : (isDark ? Colors.white70 : AppColors.zinc700),
                      ),
                    ),
                    selected: isSelected,
                    selectedColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
                    backgroundColor: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    onSelected: (_) => setState(() => _selectedCategory = cat),
                  );
                },
              ),
            ),
          ),

          Divider(height: 1, color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),

          // 4. Lista Servizi Reali con Modifica ed Elimina
          Expanded(
            child: services.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.content_cut, size: 48, color: isDark ? Colors.white30 : AppColors.zinc300),
                          const SizedBox(height: 12),
                          Text(
                            _searchQuery.isNotEmpty
                                ? 'Nessun servizio corrisponde a "$_searchQuery".'
                                : 'Nessun trattamento trovato nel listino.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: isDark ? Colors.white54 : AppColors.zinc500,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: () => _showServiceEditorDialog(context, salonId: salonId),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.obsidianBlack,
                              foregroundColor: AppColors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            icon: const Icon(Icons.add, size: 18),
                            label: const Text('Aggiungi il Primo Servizio'),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: services.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, idx) {
                      final service = services[idx];
                      return _buildServiceCard(context, service, salonId: salonId, isDark: isDark);
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showServiceEditorDialog(context, salonId: salonId),
        backgroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
        foregroundColor: isDark ? AppColors.obsidianBlack : AppColors.white,
        icon: const Icon(Icons.add, size: 20),
        label: const Text('Nuovo Trattamento', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildServiceCard(
    BuildContext context,
    SalonService service, {
    required String salonId,
    required bool isDark,
  }) {
    final salonRepo = context.read<SalonRepository>();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Intestazione con Nome e Prezzo
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  service.name,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                    color: isDark ? Colors.white : AppColors.zinc900,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '€${service.price.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                  color: AppColors.emeraldGreen,
                ),
              ),
            ],
          ),
          if (service.description.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              service.description,
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.white60 : AppColors.zinc500,
              ),
            ),
          ],
          const SizedBox(height: 12),

          // Durata, Categoria e Pulsanti di Azione Diretta "Modifica" ed "Elimina"
          Row(
            children: [
              // Badge Durata
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.access_time, size: 12, color: isDark ? Colors.white70 : AppColors.zinc600),
                    const SizedBox(width: 4),
                    Text(
                      '${service.durationMinutes} min',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : AppColors.zinc700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),

              // Badge Categoria
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  service.category,
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark ? Colors.white70 : AppColors.zinc600,
                  ),
                ),
              ),

              const Spacer(),

              // Pulsante "Modifica"
              TextButton.icon(
                onPressed: () => _showServiceEditorDialog(
                  context,
                  serviceToEdit: service,
                  salonId: salonId,
                ),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  backgroundColor: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                icon: const Icon(Icons.edit_outlined, size: 14, color: AppColors.gold),
                label: const Text(
                  'Modifica',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColors.gold,
                  ),
                ),
              ),

              const SizedBox(width: 8),

              // Pulsante "Elimina"
              TextButton.icon(
                onPressed: () => _confirmDeleteService(context, service, salonRepo, salonId),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  backgroundColor: Colors.red.withOpacity(0.1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                icon: const Icon(Icons.delete_outline, size: 14, color: Colors.red),
                label: const Text(
                  'Elimina',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Colors.red,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _confirmDeleteService(
    BuildContext context,
    SalonService service,
    SalonRepository repo,
    String salonId,
  ) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Elimina Servizio'),
        content: Text(
          'Sei sicuro di voler eliminare definitivamente "${service.name}" dal listino del salone?\nI clienti non potranno più prenotarlo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annulla', style: TextStyle(color: AppColors.zinc600)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final ok = await repo.deleteService(service.id, salonId: salonId);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(ok
                        ? 'Servizio "${service.name}" eliminato con successo dal database.'
                        : 'Servizio rimosso dal listino.'),
                    backgroundColor: Colors.red.shade700,
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('Elimina', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showServiceEditorDialog(
    BuildContext context, {
    SalonService? serviceToEdit,
    required String salonId,
  }) {
    final isEditing = serviceToEdit != null;
    final nameCtrl = TextEditingController(text: serviceToEdit?.name ?? '');
    final priceCtrl = TextEditingController(
      text: serviceToEdit != null ? serviceToEdit.price.toStringAsFixed(2) : '',
    );
    final durationCtrl = TextEditingController(
      text: serviceToEdit != null ? '${serviceToEdit.durationMinutes}' : '30',
    );
    final descCtrl = TextEditingController(text: serviceToEdit?.description ?? '');
    String category = serviceToEdit?.category ?? 'Taglio & Piega';
    if (!_categories.contains(category) && category != 'Tutti') {
      category = 'Taglio & Piega';
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
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
                        Icon(
                          isEditing ? Icons.edit_outlined : Icons.add_circle_outline,
                          color: AppColors.gold,
                          size: 22,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          isEditing ? 'Modifica Servizio' : 'Nuovo Servizio Listino',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 17,
                            color: isDark ? Colors.white : AppColors.zinc900,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: nameCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Nome Servizio (es. Taglio Sartoriale Maschile)',
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: priceCtrl,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: const InputDecoration(
                              labelText: 'Prezzo (€)',
                              prefixText: '€ ',
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: durationCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Durata (Min)',
                              suffixText: 'min',
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: _categories.sublist(1).contains(category) ? category : 'Taglio & Piega',
                      decoration: const InputDecoration(labelText: 'Categoria'),
                      dropdownColor: isDark ? const Color(0xFF2A2A2A) : AppColors.white,
                      items: _categories.sublist(1).map((cat) {
                        return DropdownMenuItem(value: cat, child: Text(cat));
                      }).toList(),
                      onChanged: (v) => setModalState(() => category = v!),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: descCtrl,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        labelText: 'Descrizione per i Clienti (opzionale)',
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () async {
                          final name = nameCtrl.text.trim();
                          if (name.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Inserisci il nome del servizio')),
                            );
                            return;
                          }

                          final price = double.tryParse(priceCtrl.text.replaceAll(',', '.').trim()) ?? 30.0;
                          final duration = int.tryParse(durationCtrl.text.trim()) ?? 30;
                          final desc = descCtrl.text.trim();

                          final repo = context.read<SalonRepository>();

                          if (isEditing) {
                            final updatedService = SalonService(
                              id: serviceToEdit.id,
                              name: name,
                              category: category,
                              price: price,
                              durationMinutes: duration,
                              description: desc,
                            );
                            await repo.updateService(updatedService, salonId: salonId);
                          } else {
                            final newService = SalonService(
                              id: 'srv-${DateTime.now().millisecondsSinceEpoch}',
                              name: name,
                              category: category,
                              price: price,
                              durationMinutes: duration,
                              description: desc,
                            );
                            await repo.addService(newService, salonId: salonId);
                          }

                          if (ctx.mounted) Navigator.pop(ctx);

                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  isEditing
                                      ? 'Servizio "$name" modificato con successo nel Cloud!'
                                      : 'Servizio "$name" aggiunto con successo al listino!',
                                ),
                                backgroundColor: AppColors.emeraldGreen,
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
                        child: Text(
                          isEditing ? 'Salva Modifiche Servizio' : 'Aggiungi al Listino',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
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
}
