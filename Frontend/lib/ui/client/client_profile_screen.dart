import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../data/repositories/auth_repository.dart';
import '../../data/repositories/fidelity_repository.dart';

class ClientProfileScreen extends StatelessWidget {
  const ClientProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final authRepo = context.watch<AuthRepository>();
    final fidelityRepo = context.watch<FidelityRepository>();
    final user = authRepo.currentUser;
    final card = fidelityRepo.clientLoyalty;

    return Scaffold(
      backgroundColor: AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Il Mio Profilo', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        backgroundColor: AppColors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Card Profilo Utente
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
                    child: Center(
                      child: Text(
                        (user?.displayName.isNotEmpty == true) ? user!.displayName[0].toUpperCase() : 'U',
                        style: const TextStyle(color: AppColors.white, fontSize: 22, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.displayName ?? 'Mario Rossi',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.zinc900),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          user?.email ?? 'mario.rossi@trimmy.it',
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
                            '${card.tierLabel.toUpperCase()} • ${card.pointsBalance} PUNTI VIP',
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

            // Opzioni e Impostazioni
            _buildOptionTile(
              icon: Icons.notifications_outlined,
              title: 'Notifiche Promemoria Appuntamenti',
              subtitle: 'SMS e notifiche push 24h prima',
              trailing: Switch(
                value: true,
                onChanged: (_) {},
                activeColor: AppColors.obsidianBlack,
              ),
            ),
            const SizedBox(height: 8),
            _buildOptionTile(
              icon: Icons.privacy_tip_outlined,
              title: 'Privacy e Consenso GDPR',
              subtitle: 'I tuoi dati sono protetti e crittografati',
              trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: AppColors.zinc400),
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Informativa Privacy conforme GDPR v2.4')),
                );
              },
            ),
            const SizedBox(height: 8),
            _buildOptionTile(
              icon: Icons.help_outline,
              title: 'Assistenza Clienti Trimmy',
              subtitle: 'Hai bisogno di supporto con una prenotazione?',
              trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: AppColors.zinc400),
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Contatta il supporto: supporto@trimmy.it')),
                );
              },
            ),

            const SizedBox(height: 30),

            // Pulsante Logout
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _confirmSignOut(context, authRepo),
                icon: const Icon(Icons.logout, size: 18, color: Colors.red),
                label: const Text('Esci dall\'Account', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
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

  Widget _buildOptionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    Widget? trailing,
    VoidCallback? onTap,
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
        trailing: trailing,
      ),
    );
  }

  void _confirmSignOut(BuildContext context, AuthRepository authRepo) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Disconnessione'),
        content: const Text('Sei sicuro di voler uscire dal tuo account Trimmy?'),
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
