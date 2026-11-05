import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/product_model.dart';
import '../../data/repositories/auth_repository.dart';
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

  final List<String> _keywordChips = [
    'Tutti',
    'Rivendita',
    'Uso Salone',
    'Sotto Scorta',
    'Shampoo',
    'Maschera',
    'Colore',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authRepo = context.read<AuthRepository>();
      final salonId = authRepo.currentUser?.salonId ?? authRepo.currentUser?.uid ?? 'salone-default';
      context.read<InventoryRepository>().setSalon(salonId);
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final invRepo = context.watch<InventoryRepository>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
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
      backgroundColor: isDark ? const Color(0xFF121212) : AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Magazzino & Prodotti', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        elevation: 0,
        actions: [
          if (invRepo.lowStockCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.red.shade900.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.red.shade400),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.warning_amber_rounded, size: 14, color: Colors.red),
                      const SizedBox(width: 4),
                      Text(
                        '${invRepo.lowStockCount} Sotto Scorta',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.red),
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
            color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
            child: Column(
              children: [
                // Input di ricerca
                Container(
                  height: 42,
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isDark ? const Color(0xFF3A3A3A) : AppColors.zinc200),
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (_) => setState(() {}),
                    style: TextStyle(fontSize: 13, color: isDark ? Colors.white : AppColors.zinc900),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search, size: 18, color: AppColors.zinc400),
                      hintText: 'Cerca prodotto per nome o marca...',
                      hintStyle: const TextStyle(fontSize: 13, color: AppColors.zinc400),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 10),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.close, size: 16, color: AppColors.zinc400),
                              onPressed: () {
                                _searchController.clear();
                                setState(() {});
                              },
                            )
                          : null,
                    ),
                  ),
                ),

                const SizedBox(height: 8),

                // Chip Suggerimenti Parole Chiave
                SizedBox(
                  height: 28,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _keywordChips.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 6),
                    itemBuilder: (context, idx) {
                      final kw = _keywordChips[idx];
                      final isActive = _searchController.text.toLowerCase() == kw.toLowerCase() ||
                          (kw == 'Tutti' && _searchController.text.isEmpty && _selectedCategory == 'Tutti');

                      return ActionChip(
                        label: Text(
                          kw == 'Tutti' ? 'Tutti i Prodotti' : '#$kw',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                            color: isActive ? AppColors.gold : (isDark ? Colors.white70 : AppColors.zinc700),
                          ),
                        ),
                        backgroundColor: isActive
                            ? (isDark ? const Color(0xFF332915) : const Color(0xFFFEF3C7))
                            : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc100),
                        side: BorderSide(
                          color: isActive ? AppColors.gold : (isDark ? const Color(0xFF3A3A3A) : AppColors.zinc200),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        visualDensity: VisualDensity.compact,
                        onPressed: () {
                          if (kw == 'Tutti') {
                            _searchController.clear();
                            setState(() => _selectedCategory = 'Tutti');
                          } else if (kw == 'Rivendita') {
                            setState(() => _selectedCategory = 'RIVENDITA');
                          } else if (kw == 'Uso Salone') {
                            setState(() => _selectedCategory = 'USO_INTERNO');
                          } else if (kw == 'Sotto Scorta') {
                            setState(() => _selectedCategory = 'Sotto Scorta');
                          } else {
                            setState(() {
                              _searchController.text = kw;
                            });
                          }
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),

          Divider(height: 1, color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),

          // Lista Prodotti Reali
          Expanded(
            child: filteredProducts.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.inventory_2_outlined, size: 52, color: isDark ? Colors.white30 : AppColors.zinc300),
                          const SizedBox(height: 12),
                          Text(
                            _searchController.text.isNotEmpty
                                ? 'Nessun prodotto corrisponde a "${_searchController.text}".'
                                : 'Magazzino vuoto. Non ci sono ancora prodotti registrati nel Cloud.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: isDark ? Colors.white70 : AppColors.zinc600,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: () => _showAddProductDialog(context, invRepo),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
                              foregroundColor: isDark ? AppColors.obsidianBlack : AppColors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            icon: const Icon(Icons.add, size: 18),
                            label: const Text('Aggiungi Primo Prodotto'),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: filteredProducts.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, idx) {
                      final product = filteredProducts[idx];
                      return _buildProductCard(context, product, invRepo, isDark);
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddProductDialog(context, invRepo),
        backgroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
        foregroundColor: isDark ? AppColors.obsidianBlack : AppColors.white,
        icon: const Icon(Icons.add, size: 20),
        label: const Text('Nuovo Prodotto', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildProductCard(BuildContext context, ProductModel product, InventoryRepository invRepo, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: product.isLowStock
              ? Colors.red.shade400
              : (isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
          width: product.isLowStock ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.3 : 0.02),
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
              color: product.isRetail
                  ? (isDark ? const Color(0xFF332915) : Colors.amber.shade50)
                  : (isDark ? const Color(0xFF14293D) : Colors.blue.shade50),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              product.isRetail ? Icons.shopping_bag_outlined : Icons.science_outlined,
              color: product.isRetail ? AppColors.gold : Colors.blue.shade400,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),

          // Informazioni prodotto
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: isDark ? Colors.white : AppColors.zinc900,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Text(
                  '${product.brand} • ${product.category == "RIVENDITA" ? "Rivendita" : "Uso Salone"}',
                  style: TextStyle(fontSize: 11, color: isDark ? Colors.white60 : AppColors.zinc500),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    if (product.isRetail) ...[
                      Text(
                        '€${product.retailPrice.toStringAsFixed(2)}',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                          color: isDark ? AppColors.gold : AppColors.zinc900,
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Text(
                      'Costo: €${product.costPrice.toStringAsFixed(2)}',
                      style: TextStyle(fontSize: 11, color: isDark ? Colors.white54 : AppColors.zinc400),
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
              color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? const Color(0xFF3A3A3A) : AppColors.zinc200),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: Icon(Icons.remove, size: 16, color: isDark ? Colors.white70 : AppColors.zinc700),
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
                      color: product.isLowStock
                          ? Colors.red
                          : (isDark ? Colors.white : AppColors.zinc900),
                    ),
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.add, size: 16, color: isDark ? Colors.white70 : AppColors.zinc700),
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
                    Text(
                      'Nuovo Prodotto a Magazzino',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: isDark ? Colors.white : AppColors.zinc900,
                      ),
                    ),
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
                            dropdownColor: isDark ? const Color(0xFF2A2A2A) : AppColors.white,
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
                          final authRepo = Provider.of<AuthRepository>(context, listen: false);
                          final salonId = authRepo.currentUser?.salonId ?? authRepo.currentUser?.id ?? 'salone-default';

                          final newProd = ProductModel(
                            id: 'prod-${DateTime.now().millisecondsSinceEpoch}',
                            tenantId: salonId,
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
                          backgroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
                          foregroundColor: isDark ? AppColors.obsidianBlack : AppColors.white,
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
