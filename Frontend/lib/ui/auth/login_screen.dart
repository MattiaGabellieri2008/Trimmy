import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/user_model.dart';
import '../../data/repositories/auth_repository.dart';
import '../client/client_main_screen.dart';
import '../salon/salon_main_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController(text: kDebugMode ? 'mario.rossi@trimmy.it' : '');
  final _passwordController = TextEditingController(text: kDebugMode ? 'password123' : '');

  @override
  Widget build(BuildContext context) {
    final authRepo = context.watch<AuthRepository>();

    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo Trimmy
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppColors.obsidianBlack,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.1),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(Icons.content_cut, color: AppColors.white, size: 30),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Trimmy.',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: AppColors.zinc900,
                    letterSpacing: -1,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'SaaS Gestionale per Saloni & Portale Marketplace',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: AppColors.zinc500),
                ),

                const SizedBox(height: 36),

                // Form Login
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.zinc50,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.zinc200),
                  ),
                  child: TextField(
                    controller: _emailController,
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.email_outlined, color: AppColors.zinc400, size: 20),
                      hintText: 'Email aziendale o personale',
                      hintStyle: TextStyle(color: AppColors.zinc400, fontSize: 13),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.all(16),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.zinc50,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.zinc200),
                  ),
                  child: TextField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.lock_outline, color: AppColors.zinc400, size: 20),
                      hintText: 'Password',
                      hintStyle: TextStyle(color: AppColors.zinc400, fontSize: 13),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.all(16),
                    ),
                  ),
                ),

                const SizedBox(height: 20),

                // Pulsante Accedi Principale
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: authRepo.isLoading ? null : () => _handleLogin(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.obsidianBlack,
                      foregroundColor: AppColors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: authRepo.isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(color: AppColors.white, strokeWidth: 2),
                          )
                        : const Text('Accedi con Credenziali', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  ),
                ),

                const SizedBox(height: 28),
                const Row(
                  children: [
                    Expanded(child: Divider(color: AppColors.zinc200)),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12),
                      child: Text('OPPURE ESPLORA SUBITO', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.zinc400)),
                    ),
                    Expanded(child: Divider(color: AppColors.zinc200)),
                  ],
                ),
                const SizedBox(height: 20),

                // Demo Quick Switches
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          authRepo.switchRole(UserRole.client);
                          Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(builder: (_) => const ClientMainScreen()),
                          );
                        },
                        icon: const Icon(Icons.person_outline, size: 16),
                        label: const Text('Demo Cliente', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.zinc800,
                          side: const BorderSide(color: AppColors.zinc200),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          authRepo.switchRole(UserRole.salon);
                          Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(builder: (_) => const SalonMainScreen()),
                          );
                        },
                        icon: const Icon(Icons.storefront_outlined, size: 16),
                        label: const Text('Demo Salone', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.zinc800,
                          side: const BorderSide(color: AppColors.zinc200),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _handleLogin(BuildContext context) async {
    final authRepo = context.read<AuthRepository>();
    await authRepo.signInWithEmailPassword(
      _emailController.text.trim(),
      _passwordController.text.trim(),
    );

    if (!mounted) return;

    final user = authRepo.currentUser;
    if (user != null && user.isSalonOwner) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const SalonMainScreen()),
      );
    } else {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const ClientMainScreen()),
      );
    }
  }
}
