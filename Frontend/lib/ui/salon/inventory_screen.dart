import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/product_model.dart';
import '../../data/repositories/inventory_repository.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  String _selectedCategory = 'Tutti';
  final _searchController = TextEditingController();

  final List<String> _categories = ['Tutti', 'RIVENDITA', 'USO_INTERNO', 'Sotto Scorta'];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final invRepo = context.watch<InventoryRepository>();
    final query = _searchController.text.toLowerCase().trim();

    final filteredProducts = invRepo.products.where((p) {
      final matchesQuery = query.isEmpty ||
          p.name.toLowerCase().contains(query) ||
          p.brand.toLowerCase().contains(query);

      bool matchesCat = true;
      if (_selectedCategory == 'RIVENDITA') {
        matchesCat = p.category == 'RIVENDITA';
      } else if (_selectedCategory == 'USO_INTERNO') {
        matchesCat = p.category == 'USO_INTERNO';
      } else if (_selectedCategory == 'Sotto Scorta') {
        matchesCat = p.isLowStock;
      }

      return matchesQuery && matchesCat;
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Magazzino & Prodotti', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        backgroundColor: AppColors.white,
        elevation: 0,
        actions: [
          if (invRepo.lowStockCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.warning_amber_rounded, size: 14, color: Colors.red.shade700),
                      const SizedBox(width: 4),
                      Text(
                        '${invRepo.lowStockCount} Sotto Scorta',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.red.shade700),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          // Barra Ricerca e Filtri Categoria
          Container(
            color: AppColors.white,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Column(
              children: [
                Container(
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppColors.zinc100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search, size: 18, color: AppColors.zinc400),
                      hintText: 'Cerca prodotto per nome o brand...',
                      hintStyle: TextStyle(fontSize: 13, color: AppColors.zinc400),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  height: 32,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _categories.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, idx) {
                      final cat = _categories[idx];
                      final isSelected = _selectedCategory == cat;
                      return ChoiceChip(
                        label: Text(
                          cat == 'USO_INTERNO' ? 'Uso Interno' : (cat == 'RIVENDITA' ? 'Rivendita' : cat),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            color: isSelected ? AppColors.white : AppColors.zinc700,
                          ),
                        ),
                        selected: isSelected,
                        selectedColor: AppColors.obsidianBlack,
                        backgroundColor: AppColors.zinc100,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        onSelected: (_) => setState(() => _selectedCategory = cat),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1, color: AppColors.zinc200),

          // Lista Prodotti
          Expanded(
            child: filteredProducts.isEmpty
                ? const Center(
                    child: Text(
                      'Nessun prodotto trovato nel magazzino.',
                      style: TextStyle(color: AppColors.zinc400, fontSize: 13),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: filteredProducts.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, idx) {
                      final product = filteredProducts[idx];
                      return _buildProductCard(context, product, invRepo);
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddProductDialog(context, invRepo),
        backgroundColor: AppColors.obsidianBlack,
        foregroundColor: AppColors.white,
        icon: const Icon(Icons.add, size: 20),
        label: const Text('Nuovo Prodotto', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildProductCard(BuildContext context, ProductModel product, InventoryRepository invRepo) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: product.isLowStock ? Colors.red.shade200 : AppColors.zinc200,
          width: product.isLowStock ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Icona categoria prodotto
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: product.isRetail ? Colors.amber.shade50 : Colors.blue.shade50,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              product.isRetail ? Icons.shopping_bag_outlined : Icons.science_outlined,
              color: product.isRetail ? Colors.amber.shade800 : Colors.blue.shade800,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),

          // Informazioni prodotto
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        product.name,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.zinc900),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '${product.brand} • ${product.category == "RIVENDITA" ? "Rivendita" : "Uso Salone"}',
                  style: const TextStyle(fontSize: 11, color: AppColors.zinc500),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    if (product.isRetail) ...[
                      Text(
                        '€${product.retailPrice.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.zinc900),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Text(
                      'Costo: €${product.costPrice.toStringAsFixed(2)}',
                      style: const TextStyle(fontSize: 11, color: AppColors.zinc400),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Controllo Giacenza con tasti +/-
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.zinc50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.zinc200),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.remove, size: 16, color: AppColors.zinc700),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                  onPressed: product.stockQuantity > 0
                      ? () => invRepo.updateStock(product.id, product.stockQuantity - 1)
                      : null,
                ),
                Container(
                  constraints: const BoxConstraints(minWidth: 32),
                  child: Text(
                    '${product.stockQuantity}',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: product.isLowStock ? Colors.red.shade700 : AppColors.zinc900,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.add, size: 16, color: AppColors.zinc700),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                  onPressed: () => invRepo.updateStock(product.id, product.stockQuantity + 1),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showAddProductDialog(BuildContext context, InventoryRepository invRepo) {
    final nameCtrl = TextEditingController();
    final brandCtrl = TextEditingController();
    final costCtrl = TextEditingController();
    final retailCtrl = TextEditingController();
    final stockCtrl = TextEditingController(text: '10');
    String category = 'RIVENDITA';

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
                    const Text('Nuovo Prodotto a Magazzino', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 14),
                    TextField(
                      controller: nameCtrl,
                      decoration: const InputDecoration(labelText: 'Nome Prodotto (es. Shampoo Idratante 250ml)'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: brandCtrl,
                      decoration: const InputDecoration(labelText: 'Brand / Marca (es. L\'Oréal, Kérastase)'),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: category,
                            decoration: const InputDecoration(labelText: 'Destinazione'),
                            items: const [
                              DropdownMenuItem(value: 'RIVENDITA', child: Text('Rivendita')),
                              DropdownMenuItem(value: 'USO_INTERNO', child: Text('Uso Salone')),
                            ],
                            onChanged: (v) => setModalState(() => category = v!),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: stockCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Giacenza Iniziale'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: costCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Costo Fornitore (€)'),
                          ),
                        ),
                        if (category == 'RIVENDITA') ...[
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextField(
                              controller: retailCtrl,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(labelText: 'Prezzo Vendita (€)'),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          if (nameCtrl.text.trim().isEmpty) return;
                          final newProd = ProductModel(
                            id: 'prod-${DateTime.now().millisecondsSinceEpoch}',
                            tenantId: 'salon-1',
                            name: nameCtrl.text.trim(),
                            brand: brandCtrl.text.trim().isNotEmpty ? brandCtrl.text.trim() : 'Generico',
                            category: category,
                            costPrice: double.tryParse(costCtrl.text.trim()) ?? 0.0,
                            retailPrice: double.tryParse(retailCtrl.text.trim()) ?? 0.0,
                            stockQuantity: int.tryParse(stockCtrl.text.trim()) ?? 1,
                            minStockThreshold: 3,
                          );
                          invRepo.addProduct(newProd);
                          Navigator.pop(ctx);
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.obsidianBlack,
                          foregroundColor: AppColors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Salva in Magazzino', style: TextStyle(fontWeight: FontWeight.bold)),
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

