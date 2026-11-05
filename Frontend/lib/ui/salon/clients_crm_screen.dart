import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../data/repositories/auth_repository.dart';
import '../../data/repositories/appointment_repository.dart';

class SalonClientsCrmScreen extends StatefulWidget {
  const SalonClientsCrmScreen({super.key});

  @override
  State<SalonClientsCrmScreen> createState() => _SalonClientsCrmScreenState();
}

class _SalonClientsCrmScreenState extends State<SalonClientsCrmScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';
  String _selectedFilter = 'Tutti';
  bool _isLoading = false;

  final List<String> _quickKeywords = [
    'Tutti',
    'VIP Club',
    'Nuovi',
    'Con Note',
    'Civitanova',
  ];

  List<Map<String, dynamic>> _realClients = [];
  StreamSubscription<QuerySnapshot>? _usersSub;
  StreamSubscription<QuerySnapshot>? _salonClientsSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initClientsSync();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _usersSub?.cancel();
    _salonClientsSub?.cancel();
    super.dispose();
  }

  void _initClientsSync() {
    final authRepo = context.read<AuthRepository>();
    final salonId = authRepo.currentUser?.salonId ?? authRepo.currentUser?.uid ?? 'salone-default';

    setState(() => _isLoading = true);

    try {
      // 1. Ascolta utenti clienti da Firestore /users
      _usersSub = FirebaseFirestore.instance
          .collection('users')
          .where('role', isEqualTo: 'cliente')
          .snapshots()
          .listen((snapshot) {
        _mergeClientDocs(snapshot.docs);
      }, onError: (e) {
        debugPrint('Errore sync utenti clienti: $e');
        setState(() => _isLoading = false);
      });

      // 2. Ascolta clienti specifici del salone in /saloni/{salonId}/clienti
      _salonClientsSub = FirebaseFirestore.instance
          .collection('saloni')
          .doc(salonId)
          .collection('clienti')
          .snapshots()
          .listen((snapshot) {
        _mergeClientDocs(snapshot.docs);
      }, onError: (e) {
        debugPrint('Errore sync clienti salone: $e');
      });
    } catch (e) {
      debugPrint('Errore ascolto clienti: $e');
      setState(() => _isLoading = false);
    }
  }

  void _mergeClientDocs(List<QueryDocumentSnapshot> docs) {
    for (final doc in docs) {
      final data = doc.data() as Map<String, dynamic>;
      final id = doc.id;
      final name = (data['displayName'] ?? data['name'] ?? data['fullName'] ?? 'Cliente').toString().trim();
      final email = (data['email'] ?? '').toString();
      final phone = (data['phone'] ?? data['phoneNumber'] ?? '+39 000 000000').toString();
      final points = (data['fidelityPoints'] as num?)?.toInt() ?? 0;
      final notes = (data['beautyNotes'] ?? data['note'] ?? '').toString();
      final tier = points >= 300 ? 'Gold VIP' : (points >= 100 ? 'Silver Club' : 'Membro Base');

      final clientObj = {
        'id': id,
        'name': name,
        'email': email,
        'phone': phone,
        'tier': tier,
        'points': points,
        'beautyNotes': notes,
        'city': data['city'] ?? 'Civitanova Marche',
      };

      final idx = _realClients.indexWhere((c) => c['id'] == id || c['email'] == email);
      if (idx != -1) {
        _realClients[idx] = clientObj;
      } else {
        _realClients.add(clientObj);
      }
    }

    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final apptRepo = context.watch<AppointmentRepository>();
    final authRepo = context.watch<AuthRepository>();
    final salonId = authRepo.currentUser?.salonId ?? authRepo.currentUser?.uid ?? 'salone-default';

    // Raccoglie anche eventuali clienti unici dagli appuntamenti reali del salone
    final allSalonAppts = apptRepo.appointments.where((a) => a.salonId == salonId).toList();
    for (final appt in allSalonAppts) {
      final exists = _realClients.any((c) =>
          c['id'] == appt.customerId ||
          c['name'].toString().toLowerCase() == appt.customerName.toLowerCase());
      if (!exists && appt.customerName.isNotEmpty) {
        _realClients.add({
          'id': appt.customerId.isNotEmpty ? appt.customerId : 'c-${appt.id}',
          'name': appt.customerName,
          'email': '',
          'phone': appt.customerPhone.isNotEmpty ? appt.customerPhone : '+39 000 000000',
          'tier': 'Cliente Attivo',
          'points': 50,
          'beautyNotes': 'Prenotato via app Trimmy per ${appt.serviceName}',
          'city': 'Civitanova Marche',
        });
      }
    }

    // Filtra per parola chiave/ricerca
    final filtered = _realClients.where((c) {
      final name = c['name'].toString().toLowerCase();
      final phone = c['phone'].toString();
      final notes = c['beautyNotes'].toString().toLowerCase();
      final tier = c['tier'].toString().toLowerCase();
      final city = c['city'].toString().toLowerCase();

      final matchesQuery = _searchQuery.isEmpty ||
          name.contains(_searchQuery.toLowerCase()) ||
          phone.contains(_searchQuery) ||
          notes.contains(_searchQuery.toLowerCase()) ||
          city.contains(_searchQuery.toLowerCase());

      if (!matchesQuery) return false;

      if (_selectedFilter == 'VIP Club') {
        return tier.contains('vip') || tier.contains('gold');
      } else if (_selectedFilter == 'Nuovi') {
        return tier.contains('base') || tier.contains('attivo');
      } else if (_selectedFilter == 'Con Note') {
        return notes.isNotEmpty;
      } else if (_selectedFilter == 'Civitanova') {
        return city.contains('civitanova');
      }

      return true;
    }).toList();

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Anagrafica & CRM Clienti', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        elevation: 0,
      ),
      body: Column(
        children: [
          // 1. Barra di Ricerca con Consigli Parole Chiave
          Container(
            color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
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
                      style: TextStyle(fontSize: 13, color: isDark ? Colors.white : AppColors.zinc900),
                      decoration: const InputDecoration(
                        hintText: 'Cerca cliente per nome, telefono o note...',
                        hintStyle: TextStyle(color: AppColors.zinc400, fontSize: 12),
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

          // 2. Chip Consigli Parole Chiave per Filtrare Velocemente
          Container(
            color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: SizedBox(
              height: 30,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _quickKeywords.length,
                separatorBuilder: (_, __) => const SizedBox(width: 6),
                itemBuilder: (context, idx) {
                  final kw = _quickKeywords[idx];
                  final isKwActive = _selectedFilter == kw;
                  return ActionChip(
                    label: Text(
                      kw == 'Tutti' ? 'Tutti i Clienti' : '#$kw',
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
                        _selectedFilter = kw;
                      });
                    },
                  );
                },
              ),
            ),
          ),

          Divider(height: 1, color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),

          // 3. Lista Schede Clienti Reali
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
                : filtered.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.people_outline, size: 52, color: isDark ? Colors.white30 : AppColors.zinc300),
                              const SizedBox(height: 12),
                              Text(
                                _searchQuery.isNotEmpty
                                    ? 'Nessun cliente corrisponde a "$_searchQuery".'
                                    : 'Nessun cliente registrato ancora nel database.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: isDark ? Colors.white54 : AppColors.zinc500,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton.icon(
                                onPressed: () => _showAddClientDialog(context, salonId: salonId),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.obsidianBlack,
                                  foregroundColor: AppColors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                icon: const Icon(Icons.person_add, size: 18),
                                label: const Text('Registra Nuovo Cliente'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final client = filtered[index];
                          return _buildClientCard(context, client, isDark: isDark, salonId: salonId);
                        },
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddClientDialog(context, salonId: salonId),
        backgroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
        foregroundColor: isDark ? AppColors.obsidianBlack : AppColors.white,
        icon: const Icon(Icons.person_add, size: 18),
        label: const Text('Nuovo Cliente', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildClientCard(
    BuildContext context,
    Map<String, dynamic> client, {
    required bool isDark,
    required String salonId,
  }) {
    final initials = client['name'].toString().split(' ').map((n) => n.isNotEmpty ? n[0] : '').take(2).join();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.3 : 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: isDark ? const Color(0xFF332915) : AppColors.obsidianBlack,
                      child: Text(
                        initials.toUpperCase(),
                        style: TextStyle(
                          color: isDark ? AppColors.gold : AppColors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            client['name'].toString(),
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: isDark ? Colors.white : AppColors.zinc900,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            client['phone'].toString(),
                            style: TextStyle(
                              fontSize: 11,
                              color: isDark ? Colors.white54 : AppColors.zinc500,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF332915) : AppColors.goldSurface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.gold.withOpacity(0.4)),
                ),
                child: Text(
                  '${client['tier']} • ${client['points']} pt',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: AppColors.gold,
                  ),
                ),
              ),
            ],
          ),
          if (client['beautyNotes'].toString().isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2A2A2A) : AppColors.zinc50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isDark ? const Color(0xFF3A3A3A) : AppColors.zinc200),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.notes_rounded, size: 14, color: AppColors.gold),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      client['beautyNotes'].toString(),
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? Colors.white70 : AppColors.zinc700,
                        height: 1.3,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton.icon(
                onPressed: () => _showEditNotesModal(context, client, salonId: salonId),
                icon: const Icon(Icons.edit_note, size: 16, color: AppColors.gold),
                label: const Text(
                  'Note Scheda Tecnica',
                  style: TextStyle(fontSize: 11, color: AppColors.gold, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showAddClientDialog(BuildContext context, {required String salonId}) {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Registra Nuovo Cliente in Archivio',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: isDark ? Colors.white : AppColors.zinc900,
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Nome e Cognome'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Numero di Telefono (per SMS promemoria)'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: notesCtrl,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Note Tecniche / Preferenze Taglio & Colore'),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    final name = nameCtrl.text.trim();
                    if (name.isEmpty) return;

                    final clientId = 'client-${DateTime.now().millisecondsSinceEpoch}';
                    final clientData = {
                      'id': clientId,
                      'name': name,
                      'displayName': name,
                      'phone': phoneCtrl.text.trim(),
                      'beautyNotes': notesCtrl.text.trim(),
                      'fidelityPoints': 50,
                      'role': 'cliente',
                      'city': 'Civitanova Marche',
                      'createdAt': FieldValue.serverTimestamp(),
                    };

                    try {
                      await FirebaseFirestore.instance
                          .collection('saloni')
                          .doc(salonId)
                          .collection('clienti')
                          .doc(clientId)
                          .set(clientData);

                      setState(() {
                        _realClients.add({
                          'id': clientId,
                          'name': name,
                          'phone': phoneCtrl.text.trim(),
                          'tier': 'Membro Base',
                          'points': 50,
                          'beautyNotes': notesCtrl.text.trim(),
                          'city': 'Civitanova Marche',
                        });
                      });
                    } catch (e) {
                      debugPrint('Errore salvataggio cliente: $e');
                    }

                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
                    foregroundColor: isDark ? AppColors.obsidianBlack : AppColors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Salva Scheda Cliente', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showEditNotesModal(BuildContext context, Map<String, dynamic> client, {required String salonId}) {
    final notesCtrl = TextEditingController(text: client['beautyNotes'].toString());
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : AppColors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Note Tecniche: ${client['name']}',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: isDark ? Colors.white : AppColors.zinc900,
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: notesCtrl,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Formule colore, sensibilità cutanea, preferenze styling',
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    final newNotes = notesCtrl.text.trim();
                    final id = client['id'].toString();

                    try {
                      await FirebaseFirestore.instance
                          .collection('saloni')
                          .doc(salonId)
                          .collection('clienti')
                          .doc(id)
                          .set({'beautyNotes': newNotes}, SetOptions(merge: true));

                      await FirebaseFirestore.instance
                          .collection('users')
                          .doc(id)
                          .set({'beautyNotes': newNotes}, SetOptions(merge: true));
                    } catch (_) {}

                    setState(() {
                      client['beautyNotes'] = newNotes;
                    });

                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isDark ? AppColors.gold : AppColors.obsidianBlack,
                    foregroundColor: isDark ? AppColors.obsidianBlack : AppColors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Aggiorna Note', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
