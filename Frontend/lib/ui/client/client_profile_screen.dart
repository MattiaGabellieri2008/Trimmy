import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/theme_repository.dart';
import '../../data/repositories/auth_repository.dart';
import '../../data/repositories/fidelity_repository.dart';

class ClientProfileScreen extends StatefulWidget {
  const ClientProfileScreen({super.key});

  @override
  State<ClientProfileScreen> createState() => _ClientProfileScreenState();
}

class _ClientProfileScreenState extends State<ClientProfileScreen> {
  static const String _remindersPrefKey = 'trimmy_notifications_reminders';
  static const String _smsPrefKey = 'trimmy_sms_reminders_enabled';
  bool _remindersEnabled = true;
  bool _smsRemindersEnabled = true;

  @override
  void initState() {
    super.initState();
    _loadNotificationPreferences();
  }

  Future<void> _loadNotificationPreferences() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final enabled = prefs.getBool(_remindersPrefKey) ?? true;
      final smsEnabled = prefs.getBool(_smsPrefKey) ?? true;
      if (mounted) {
        setState(() {
          _remindersEnabled = enabled;
          _smsRemindersEnabled = smsEnabled;
        });
      }
    } catch (_) {}
  }

  Future<void> _toggleReminders(bool value, String? uid) async {
    setState(() => _remindersEnabled = value);

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_remindersPrefKey, value);

      if (uid != null && uid.isNotEmpty) {
        await FirebaseFirestore.instance.collection('users').doc(uid).set({
          'appointmentReminders': value,
          'remindersUpdatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
      }
    } catch (e) {
      debugPrint('Errore salvataggio preferenza notifiche: $e');
    }

    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          value
              ? 'Notifiche push 24h attivate con successo! Riceverai avvisi prima di ogni appuntamento.'
              : 'Notifiche push appuntamenti disattivate.',
          style: const TextStyle(fontWeight: FontWeight.w500),
        ),
        backgroundColor: value ? AppColors.emeraldGreen : AppColors.zinc800,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  Future<void> _toggleSmsReminders(bool value, String? uid) async {
    setState(() => _smsRemindersEnabled = value);

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_smsPrefKey, value);

      if (uid != null && uid.isNotEmpty) {
        await FirebaseFirestore.instance.collection('users').doc(uid).set({
          'smsRemindersEnabled': value,
          'smsUpdatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
      }
    } catch (e) {
      debugPrint('Errore salvataggio preferenza SMS: $e');
    }

    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          value
              ? 'Notifiche SMS promemoria attivate! Riceverai un SMS gratuito 24h prima dell\'appuntamento.'
              : 'Promemoria SMS disattivati.',
          style: const TextStyle(fontWeight: FontWeight.w500),
        ),
        backgroundColor: value ? AppColors.indigo : AppColors.zinc800,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final themeRepo = context.watch<ThemeRepository>();
    final isDark = themeRepo.isDarkMode(context);
    final authRepo = context.watch<AuthRepository>();
    final fidelityRepo = context.watch<FidelityRepository>();
    final user = authRepo.currentUser;
    final card = fidelityRepo.clientLoyalty;

    final cardBg = isDark ? AppColors.zinc900 : AppColors.white;
    final borderColor = isDark ? AppColors.zinc800 : AppColors.zinc200;
    final titleColor = isDark ? AppColors.white : AppColors.zinc900;
    final subColor = isDark ? AppColors.zinc400 : AppColors.zinc500;

    return Scaffold(
      backgroundColor: isDark ? AppColors.obsidianBlack : AppColors.zinc50,
      appBar: AppBar(
        title: const Text('Il Mio Profilo', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        backgroundColor: isDark ? AppColors.zinc900 : AppColors.white,
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
                color: cardBg,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: borderColor),
              ),
              child: Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.zinc800 : AppColors.obsidianBlack,
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
                          user?.displayName ?? 'Utente Trimmy',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: titleColor),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          user?.email ?? '',
                          style: TextStyle(fontSize: 12, color: subColor),
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade50.withOpacity(isDark ? 0.2 : 1.0),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: Colors.amber.shade300),
                          ),
                          child: Text(
                            '${card.tierLabel.toUpperCase()} • ${card.pointsBalance} PUNTI VIP',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              color: isDark ? Colors.amber.shade300 : Colors.amber.shade900,
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

            // 1. TEMA DARK MODE
            _buildOptionTile(
              isDark: isDark,
              cardBg: cardBg,
              borderColor: borderColor,
              titleColor: titleColor,
              subColor: subColor,
              icon: isDark ? Icons.dark_mode : Icons.dark_mode_outlined,
              title: 'Modalità Scura (Dark Mode)',
              subtitle: 'Interfaccia scura di lusso ad alto contrasto',
              trailing: Switch(
                value: isDark,
                onChanged: (val) => themeRepo.toggleDarkMode(val),
                activeColor: AppColors.gold,
              ),
            ),

            const SizedBox(height: 8),

            // 2. NOTIFICHE PUSH
            _buildOptionTile(
              isDark: isDark,
              cardBg: cardBg,
              borderColor: borderColor,
              titleColor: titleColor,
              subColor: subColor,
              icon: Icons.notifications_outlined,
              title: 'Notifiche Push Promemoria',
              subtitle: 'Avviso pop-up e promemoria 24h prima',
              trailing: Switch(
                value: _remindersEnabled,
                onChanged: (val) => _toggleReminders(val, user?.id),
                activeColor: AppColors.gold,
              ),
            ),

            const SizedBox(height: 8),

            // 3. NOTIFICHE SMS (Richiesta specifica 3)
            _buildOptionTile(
              isDark: isDark,
              cardBg: cardBg,
              borderColor: borderColor,
              titleColor: titleColor,
              subColor: subColor,
              icon: Icons.sms_outlined,
              title: 'Promemoria SMS sul Cellulare',
              subtitle: 'SMS gratuito con dettagli appuntamento e link rapido',
              trailing: Switch(
                value: _smsRemindersEnabled,
                onChanged: (val) => _toggleSmsReminders(val, user?.id),
                activeColor: AppColors.gold,
              ),
            ),

            const SizedBox(height: 8),

            // 4. PRIVACY
            _buildOptionTile(
              isDark: isDark,
              cardBg: cardBg,
              borderColor: borderColor,
              titleColor: titleColor,
              subColor: subColor,
              icon: Icons.privacy_tip_outlined,
              title: 'Privacy e Consenso GDPR',
              subtitle: 'I tuoi dati sono protetti e crittografati su Cloud',
              trailing: Icon(Icons.arrow_forward_ios, size: 14, color: subColor),
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Informativa Privacy conforme GDPR v2.4')),
                );
              },
            ),

            const SizedBox(height: 8),

            // 5. SUPPORTO
            _buildOptionTile(
              isDark: isDark,
              cardBg: cardBg,
              borderColor: borderColor,
              titleColor: titleColor,
              subColor: subColor,
              icon: Icons.help_outline,
              title: 'Assistenza Clienti Trimmy',
              subtitle: 'Hai bisogno di supporto con una prenotazione?',
              trailing: Icon(Icons.arrow_forward_ios, size: 14, color: subColor),
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
                  side: BorderSide(color: Colors.red.shade300),
                  backgroundColor: Colors.red.shade50.withOpacity(isDark ? 0.15 : 1.0),
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
    required bool isDark,
    required Color cardBg,
    required Color borderColor,
    required Color titleColor,
    required Color subColor,
    required IconData icon,
    required String title,
    required String subtitle,
    Widget? trailing,
    VoidCallback? onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor),
      ),
      child: ListTile(
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: isDark ? AppColors.zinc800 : AppColors.zinc100,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, size: 20, color: isDark ? AppColors.white : AppColors.zinc700),
        ),
        title: Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: titleColor)),
        subtitle: Text(subtitle, style: TextStyle(fontSize: 11, color: subColor)),
        trailing: trailing,
      ),
    );
  }

  void _confirmSignOut(BuildContext context, AuthRepository authRepo) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Disconnessione', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('Sei sicuro di voler effettuare il logout dal tuo account Trimmy?'),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Annulla', style: TextStyle(color: AppColors.zinc500)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(dialogContext);
              await authRepo.signOut();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Esci', style: TextStyle(color: AppColors.white)),
          ),
        ],
      ),
    );
  }
}
