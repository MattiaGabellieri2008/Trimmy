import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/user_model.dart';
import '../../data/repositories/auth_repository.dart';
import 'agenda_screen.dart';
import 'pos_checkout_screen.dart';
import 'clients_crm_screen.dart';

class SalonMainScreen extends StatefulWidget {
  const SalonMainScreen({super.key});

  @override
  State<SalonMainScreen> createState() => _SalonMainScreenState();
}

class _SalonMainScreenState extends State<SalonMainScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    SalonAgendaScreen(),
    PosCheckoutScreen(),
    SalonClientsCrmScreen(),
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
              icon: Icon(Icons.calendar_month_outlined),
              activeIcon: Icon(Icons.calendar_month),
              label: 'Agenda',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.point_of_sale_outlined),
              activeIcon: Icon(Icons.point_of_sale),
              label: 'Punto Cassa',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.people_alt_outlined),
              activeIcon: Icon(Icons.people_alt),
              label: 'CRM Clienti',
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          // Switch rapido per demo al ruolo Client
          context.read<AuthRepository>().switchRole(UserRole.client);
        },
        backgroundColor: AppColors.obsidianBlack,
        foregroundColor: AppColors.white,
        icon: const Icon(Icons.person, size: 18),
        label: const Text('Passa a Cliente', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
      ),
    );
  }
}
