import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../data/repositories/auth_repository.dart';
import 'services_catalog_screen.dart';
import 'analytics_screen.dart';

class SalonProfileScreen extends StatelessWidget {
  const SalonProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final authRepo = context.watch<AuthRepository>();
    final user = authRepo.currentUser;

    return Scaffold(
      backgroundColor: AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Gestione Salone & Profilo', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        backgroundColor: AppColors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Card Profilo Salone
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.zinc200),
              ),
              child: Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: AppColors.obsidianBlack,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Center(
                      child: Icon(Icons.storefront, color: AppColors.white, size: 28),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.salonName ?? user?.displayName ?? 'Atelier Bellezza Duomo',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.zinc900),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          user?.email ?? 'salone@trimmy.it',
                          style: const TextStyle(fontSize: 12, color: AppColors.zinc500),
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade50,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: Colors.amber.shade300),
                          ),
                          child: Text(
                            'PIANO PRO CLOUD ATTIVO',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              color: Colors.amber.shade900,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Moduli di Gestione Avanzata
            const Text(
              'Moduli Gestionali',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.zinc700),
            ),
            const SizedBox(height: 10),

            _buildActionTile(
              context: context,
              icon: Icons.content_cut,
              title: 'Listino Trattamenti & Servizi',
              subtitle: 'Prezzi, durate e categorie del salone',
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
              icon: Icons.insights,
              title: 'Statistiche, Incassi & KPI',
              subtitle: 'Fatturato, scontrino medio e trend',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AnalyticsScreen()),
                );
              },
            ),

            const SizedBox(height: 20),

            // Informazioni e Sincronizzazione Cloud
            const Text(
              'Infrastruttura & Sicurezza',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.zinc700),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.zinc200),
              ),
              child: const Column(
                children: [
                  Row(
                    children: [
                      Icon(Icons.cloud_done_outlined, size: 20, color: AppColors.emeraldGreen),
                      SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Firebase & Google Cloud Synced', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                            Text('Database Firestore in tempo reale per appuntamenti e magazzino', style: TextStyle(fontSize: 11, color: AppColors.zinc500)),
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
                  side: BorderSide(color: Colors.red.shade200),
                  backgroundColor: Colors.red.shade50,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
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
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.zinc200),
      ),
      child: ListTile(
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppColors.zinc100,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, size: 20, color: AppColors.zinc800),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.zinc900)),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 11, color: AppColors.zinc500)),
        trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: AppColors.zinc400),
      ),
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
}

