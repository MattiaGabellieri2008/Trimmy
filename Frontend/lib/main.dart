import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'core/theme/app_theme.dart';
import 'data/models/user_model.dart';
import 'data/repositories/auth_repository.dart';
import 'data/repositories/salon_repository.dart';
import 'data/repositories/appointment_repository.dart';
import 'data/repositories/fidelity_repository.dart';
import 'ui/auth/login_screen.dart';
import 'ui/client/client_main_screen.dart';
import 'ui/salon/salon_main_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('it_IT', null);

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthRepository()),
        ChangeNotifierProvider(create: (_) => SalonRepository()),
        ChangeNotifierProvider(create: (_) => AppointmentRepository()),
        ChangeNotifierProvider(create: (_) => FidelityRepository()),
      ],
      child: const TrimmyApp(),
    ),
  );
}

class TrimmyApp extends StatelessWidget {
  const TrimmyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Trimmy Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.light,
      home: const AppRootRouter(),
    );
  }
}

class AppRootRouter extends StatelessWidget {
  const AppRootRouter({super.key});

  @override
  Widget build(BuildContext context) {
    final authRepo = context.watch<AuthRepository>();

    if (!authRepo.isAuthenticated) {
      return const LoginScreen();
    }

    final user = authRepo.currentUser;
    if (user != null && user.isSalonOwner) {
      return const SalonMainScreen();
    }

    return const ClientMainScreen();
  }
}
