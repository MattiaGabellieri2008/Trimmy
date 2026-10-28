import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/user_model.dart';
import '../../data/repositories/auth_repository.dart';
import 'marketplace_screen.dart';
import 'appointments_screen.dart';
import 'fidelity_wallet_screen.dart';

class ClientMainScreen extends StatefulWidget {
  const ClientMainScreen({super.key});

  @override
  State<ClientMainScreen> createState() => _ClientMainScreenState();
}

class _ClientMainScreenState extends State<ClientMainScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    MarketplaceScreen(),
    AppointmentsScreen(),
    FidelityWalletScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.white,
          border: Border(top: BorderSide(color: AppColors.zinc200, width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.explore_outlined),
              activeIcon: Icon(Icons.explore),
              label: 'Saloni',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.calendar_today_outlined),
              activeIcon: Icon(Icons.calendar_today),
              label: 'Appuntamenti',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.stars_outlined),
              activeIcon: Icon(Icons.stars),
              label: 'Fidelity VIP',
            ),
          ],
        ),
      ),
      floatingActionButton: kDebugMode
          ? FloatingActionButton.extended(
              onPressed: () {
                // Switch rapido per test debug al ruolo Salon
                context.read<AuthRepository>().switchRole(UserRole.salon);
              },
              backgroundColor: AppColors.obsidianBlack,
              foregroundColor: AppColors.white,
              icon: const Icon(Icons.storefront, size: 18),
              label: const Text('Passa a Salone (Debug)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
            )
          : null,
    );
  }
}
