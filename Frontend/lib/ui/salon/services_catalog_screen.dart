import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/service_model.dart';
import '../../data/repositories/salon_repository.dart';

class ServicesCatalogScreen extends StatefulWidget {
  const ServicesCatalogScreen({super.key});

  @override
  State<ServicesCatalogScreen> createState() => _ServicesCatalogScreenState();
}

class _ServicesCatalogScreenState extends State<ServicesCatalogScreen> {
  String _selectedCategory = 'Tutti';
  final List<String> _categories = [
    'Tutti',
    'Taglio & Piega',
    'Colore',
    'Curativi',
    'Barba',
    'Estetica',
  ];

  @override
  Widget build(BuildContext context) {
    final salonRepo = context.watch<SalonRepository>();

    final services = salonRepo.services.where((s) {
      if (_selectedCategory == 'Tutti') return true;
      return s.category.toLowerCase().contains(_selectedCategory.toLowerCase());
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Listino Trattamenti', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        backgroundColor: AppColors.white,
        elevation: 0,
      ),
      body: Column(
        children: [
          // Filtri Categorie Orizzontali
          Container(
            color: AppColors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
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
                        color: isSelected ? AppColors.white : AppColors.zinc700,
                      ),
                    ),
                    selected: isSelected,
                    selectedColor: AppColors.obsidianBlack,
                    backgroundColor: AppColors.zinc100,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    onSelected: (_) => setState(() => _selectedCategory = cat),
                  );
                },
              ),
            ),
          ),

          const Divider(height: 1, color: AppColors.zinc200),

          // Lista Servizi
          Expanded(
            child: services.isEmpty
                ? const Center(
                    child: Text(
                      'Nessun trattamento trovato per questa categoria.',
                      style: TextStyle(color: AppColors.zinc400, fontSize: 13),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: services.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, idx) {
                      final service = services[idx];
                      return _buildServiceCard(context, service);
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddServiceDialog(context),
        backgroundColor: AppColors.obsidianBlack,
        foregroundColor: AppColors.white,
        icon: const Icon(Icons.add, size: 20),
        label: const Text('Nuovo Trattamento', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildServiceCard(BuildContext context, SalonService service) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.zinc200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  service.name,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.zinc900),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '€${service.price.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 15,
                  color: AppColors.emeraldGreen,
                ),
              ),
            ],
          ),
          if (service.description.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              service.description,
              style: const TextStyle(fontSize: 12, color: AppColors.zinc500),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.zinc100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.access_time, size: 12, color: AppColors.zinc600),
                    const SizedBox(width: 4),
                    Text(
                      '${service.durationMinutes} min',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.zinc700),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.zinc100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  service.category,
                  style: const TextStyle(fontSize: 11, color: AppColors.zinc600),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showAddServiceDialog(BuildContext context) {
    final nameCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final durationCtrl = TextEditingController(text: '30');
    final descCtrl = TextEditingController();
    String category = 'Taglio & Piega';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.white,
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
                    const Text('Aggiungi Trattamento al Listino', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 14),
                    TextField(
                      controller: nameCtrl,
                      decoration: const InputDecoration(labelText: 'Nome Servizio (es. Taglio Donna Sfumato)'),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: priceCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Prezzo (€)'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: durationCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Durata (Minuti)'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: category,
                      decoration: const InputDecoration(labelText: 'Categoria'),
                      items: const [
                        DropdownMenuItem(value: 'Taglio & Piega', child: Text('Taglio & Piega')),
                        DropdownMenuItem(value: 'Colore', child: Text('Colorazione & Balayage')),
                        DropdownMenuItem(value: 'Curativi', child: Text('Trattamenti Curativi')),
                        DropdownMenuItem(value: 'Barba', child: Text('Barba & Rasatura')),
                        DropdownMenuItem(value: 'Estetica', child: Text('Estetica')),
                      ],
                      onChanged: (v) => setModalState(() => category = v!),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: descCtrl,
                      maxLines: 2,
                      decoration: const InputDecoration(labelText: 'Breve Descrizione per i Clienti'),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          if (nameCtrl.text.trim().isEmpty) return;
                          final newService = SalonService(
                            id: 'srv-${DateTime.now().millisecondsSinceEpoch}',
                            name: nameCtrl.text.trim(),
                            category: category,
                            price: double.tryParse(priceCtrl.text.trim()) ?? 30.0,
                            durationMinutes: int.tryParse(durationCtrl.text.trim()) ?? 30,
                            description: descCtrl.text.trim(),
                          );
                          // Inserisce nel repository
                          final repo = context.read<SalonRepository>();
                          repo.services.add(newService);
                          // ignore: invalid_use_of_protected_member, invalid_use_of_visible_for_testing_member
                          repo.notifyListeners();
                          Navigator.pop(ctx);
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.obsidianBlack,
                          foregroundColor: AppColors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Aggiungi al Listino', style: TextStyle(fontWeight: FontWeight.bold)),
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

