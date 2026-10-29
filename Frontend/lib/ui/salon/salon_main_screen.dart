import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import 'agenda_screen.dart';
import 'pos_checkout_screen.dart';
import 'inventory_screen.dart';
import 'clients_crm_screen.dart';
import 'salon_profile_screen.dart';

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
    InventoryScreen(),
    SalonClientsCrmScreen(),
    SalonProfileScreen(),
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
          type: BottomNavigationBarType.fixed,
          selectedItemColor: AppColors.obsidianBlack,
          unselectedItemColor: AppColors.zinc400,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontSize: 10),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.calendar_month_outlined),
              activeIcon: Icon(Icons.calendar_month),
              label: 'Agenda',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.point_of_sale_outlined),
              activeIcon: Icon(Icons.point_of_sale),
              label: 'Cassa POS',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.inventory_2_outlined),
              activeIcon: Icon(Icons.inventory_2),
              label: 'Magazzino',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.people_alt_outlined),
              activeIcon: Icon(Icons.people_alt),
              label: 'Clienti',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.tune_outlined),
              activeIcon: Icon(Icons.tune),
              label: 'Gestione',
            ),
          ],
        ),
      ),
    );
  }
}
