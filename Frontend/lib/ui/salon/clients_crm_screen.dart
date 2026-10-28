import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class SalonClientsCrmScreen extends StatefulWidget {
  const SalonClientsCrmScreen({super.key});

  @override
  State<SalonClientsCrmScreen> createState() => _SalonClientsCrmScreenState();
}

class _SalonClientsCrmScreenState extends State<SalonClientsCrmScreen> {
  String _searchQuery = '';

  final List<Map<String, dynamic>> _clients = [
    {
      'id': 'c-1',
      'name': 'Mario Rossi',
      'phone': '+39 340 1234567',
      'tier': 'Silver Club',
      'points': 180,
      'activeCarnets': 2,
      'beautyNotes': 'Preferisce sfumatura bassa a 1.5mm, pettinato all\'indietro. Cute sensibile ai prodotti alcolici.',
      'lastVisit': '14 giorni fa',
    },
    {
      'id': 'c-2',
      'name': 'Giulia Bianchi',
      'phone': '+39 333 9988776',
      'tier': 'Gold Client',
      'points': 340,
      'activeCarnets': 1,
      'beautyNotes': 'Balayage tono caldo miele dorato. No decolorazione forte sulle punte per evitare doppie punte.',
      'lastVisit': 'Ieri',
    },
    {
      'id': 'c-3',
      'name': 'Alessandro Conti',
      'phone': '+39 349 5544332',
      'tier': 'Bronze Member',
      'points': 40,
      'activeCarnets': 0,
      'beautyNotes': 'Rasatura tradizionale barba ogni 3 settimane. Olio idratante al sandalo.',
      'lastVisit': '28 giorni fa',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final filtered = _clients.where((c) {
      return c['name'].toString().toLowerCase().contains(_searchQuery.toLowerCase()) ||
          c['phone'].toString().contains(_searchQuery);
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Anagrafica & CRM Clienti', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: Column(
        children: [
          // Barra di Ricerca
          Padding(
            padding: const EdgeInsets.all(16),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.zinc200),
              ),
              child: TextField(
                onChanged: (val) => setState(() => _searchQuery = val),
                decoration: const InputDecoration(
                  hintText: 'Cerca per nome cliente o telefono...',
                  hintStyle: TextStyle(color: AppColors.zinc400, fontSize: 13),
                  prefixIcon: Icon(Icons.search, color: AppColors.zinc400, size: 20),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
            ),
          ),

          // Lista Schede Clienti
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: filtered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final client = filtered[index];
                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.zinc200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.between,
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                CircleAvatar(
                                  backgroundColor: AppColors.obsidianBlack,
                                  child: Text(
                                    client['name'].toString().split(' ').map((n) => n.isNotEmpty ? n[0] : '').take(2).join(),
                                    style: const TextStyle(color: AppColors.white, fontWeight: FontWeight.bold, fontSize: 12),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        client['name'].toString(),
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      Text(
                                        client['phone'].toString(),
                                        style: const TextStyle(fontSize: 11, color: AppColors.zinc500),
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
                              color: AppColors.goldSurface,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              '${client['tier']} • ${client['points']} pt',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF92400E),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Note Tecniche di Bellezza
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.zinc50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.zinc200),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.content_cut, size: 14, color: AppColors.zinc400),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                client['beautyNotes'].toString(),
                                style: const TextStyle(fontSize: 11, color: AppColors.zinc600),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),

                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Ultima visita: ${client['lastVisit']}',
                            style: const TextStyle(fontSize: 10, color: AppColors.zinc400),
                          ),
                          if (client['activeCarnets'] > 0)
                            Text(
                              '${client['activeCarnets']} Carnet attivi',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.indigo),
                            ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
