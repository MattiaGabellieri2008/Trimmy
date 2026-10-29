import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/user_model.dart';
import '../../data/repositories/auth_repository.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Controller Login
  final _loginEmailController = TextEditingController();
  final _loginPasswordController = TextEditingController();

  // Controller Registrazione
  final _regNameController = TextEditingController();
  final _regEmailController = TextEditingController();
  final _regPhoneController = TextEditingController();
  final _regPasswordController = TextEditingController();
  final _regSalonNameController = TextEditingController();
  final _regAddressController = TextEditingController();

  UserRole _selectedRole = UserRole.client;
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _loginEmailController.dispose();
    _loginPasswordController.dispose();
    _regNameController.dispose();
    _regEmailController.dispose();
    _regPhoneController.dispose();
    _regPasswordController.dispose();
    _regSalonNameController.dispose();
    _regAddressController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authRepo = context.watch<AuthRepository>();

    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo & Titolo Trimmy
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: AppColors.obsidianBlack,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.12),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(Icons.content_cut, color: AppColors.white, size: 28),
                  ),
                ),
                const SizedBox(height: 14),
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
                  'Piattaforma Saloni di Bellezza & Marketplace',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: AppColors.zinc500),
                ),

                const SizedBox(height: 28),

                // Tab Switcher Accedi / Registrati
                Container(
                  height: 46,
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: AppColors.zinc100,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: TabBar(
                    controller: _tabController,
                    indicator: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.06),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    indicatorSize: TabBarIndicatorSize.tab,
                    dividerColor: Colors.transparent,
                    labelColor: AppColors.zinc900,
                    unselectedLabelColor: AppColors.zinc500,
                    labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    tabs: const [
                      Tab(text: 'Accedi'),
                      Tab(text: 'Registrati'),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // Contenuto dinamico delle Tab
                AnimatedBuilder(
                  animation: _tabController,
                  builder: (context, _) {
                    return _tabController.index == 0
                        ? _buildLoginForm(authRepo)
                        : _buildRegisterForm(authRepo);
                  },
                ),

                const SizedBox(height: 28),

                // Separatore Accesso Rapido Demo
                const Row(
                  children: [
                    Expanded(child: Divider(color: AppColors.zinc200)),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12),
                      child: Text(
                        'OPPURE ACCESSO RAPIDO DEMO',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: AppColors.zinc400,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    Expanded(child: Divider(color: AppColors.zinc200)),
                  ],
                ),
                const SizedBox(height: 16),

                // Bottoni Demo Espliciti
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: authRepo.isLoading ? null : () => authRepo.signInDemo(UserRole.client),
                        icon: const Icon(Icons.person, size: 16),
                        label: const Text('Cliente Demo', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.zinc800,
                          side: const BorderSide(color: AppColors.zinc300),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: authRepo.isLoading ? null : () => authRepo.signInDemo(UserRole.salon),
                        icon: const Icon(Icons.storefront, size: 16),
                        label: const Text('Salone Demo', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.zinc800,
                          side: const BorderSide(color: AppColors.zinc300),
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

  Widget _buildLoginForm(AuthRepository authRepo) {
    return Column(
      children: [
        _buildTextField(
          controller: _loginEmailController,
          hint: 'Email (es. cliente@trimmy.it)',
          icon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 12),
        _buildTextField(
          controller: _loginPasswordController,
          hint: 'Password',
          icon: Icons.lock_outline,
          isPassword: true,
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: authRepo.isLoading ? null : _submitLogin,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.obsidianBlack,
              foregroundColor: AppColors.white,
              padding: const EdgeInsets.symmetric(vertical: 15),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            child: authRepo.isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(color: AppColors.white, strokeWidth: 2),
                  )
                : const Text('Accedi a Trimmy', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          ),
        ),
      ],
    );
  }

  Widget _buildRegisterForm(AuthRepository authRepo) {
    final isSalon = _selectedRole == UserRole.salon;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Seleziona il tipo di profilo:',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.zinc700),
        ),
        const SizedBox(height: 8),

        // Selettore Ruolo (Cliente vs Salone)
        Row(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _selectedRole = UserRole.client),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                  decoration: BoxDecoration(
                    color: !isSalon ? AppColors.obsidianBlack : AppColors.zinc50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: !isSalon ? AppColors.obsidianBlack : AppColors.zinc300),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.person, size: 16, color: !isSalon ? AppColors.white : AppColors.zinc600),
                      const SizedBox(width: 6),
                      Text(
                        'Cliente',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: !isSalon ? AppColors.white : AppColors.zinc700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _selectedRole = UserRole.salon),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                  decoration: BoxDecoration(
                    color: isSalon ? AppColors.obsidianBlack : AppColors.zinc50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isSalon ? AppColors.obsidianBlack : AppColors.zinc300),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.storefront, size: 16, color: isSalon ? AppColors.white : AppColors.zinc600),
                      const SizedBox(width: 6),
                      Text(
                        'Salone / Barber',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: isSalon ? AppColors.white : AppColors.zinc700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),

        const SizedBox(height: 14),

        _buildTextField(
          controller: _regNameController,
          hint: isSalon ? 'Nome Titolare' : 'Nome e Cognome',
          icon: Icons.person_outline,
        ),
        if (isSalon) ...[
          const SizedBox(height: 10),
          _buildTextField(
            controller: _regSalonNameController,
            hint: 'Nome del Salone / Barber Shop',
            icon: Icons.storefront_outlined,
          ),
          const SizedBox(height: 10),
          _buildTextField(
            controller: _regAddressController,
            hint: 'Indirizzo (es. Via Torino 15, Milano)',
            icon: Icons.location_on_outlined,
          ),
        ],
        const SizedBox(height: 10),
        _buildTextField(
          controller: _regPhoneController,
          hint: 'Numero di Telefono',
          icon: Icons.phone_outlined,
          keyboardType: TextInputType.phone,
        ),
        const SizedBox(height: 10),
        _buildTextField(
          controller: _regEmailController,
          hint: 'Indirizzo Email',
          icon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 10),
        _buildTextField(
          controller: _regPasswordController,
          hint: 'Password (min. 6 caratteri)',
          icon: Icons.lock_outline,
          isPassword: true,
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: authRepo.isLoading ? null : _submitRegister,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.obsidianBlack,
              foregroundColor: AppColors.white,
              padding: const EdgeInsets.symmetric(vertical: 15),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            child: authRepo.isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(color: AppColors.white, strokeWidth: 2),
                  )
                : Text(
                    isSalon ? 'Registra Salone su Firebase' : 'Crea Account Cliente',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool isPassword = false,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.zinc50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.zinc200),
      ),
      child: TextField(
        controller: controller,
        obscureText: isPassword && _obscurePassword,
        keyboardType: keyboardType,
        style: const TextStyle(fontSize: 13, color: AppColors.zinc900),
        decoration: InputDecoration(
          prefixIcon: Icon(icon, color: AppColors.zinc400, size: 18),
          suffixIcon: isPassword
              ? IconButton(
                  icon: Icon(
                    _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                    color: AppColors.zinc400,
                    size: 18,
                  ),
                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                )
              : null,
          hintText: hint,
          hintStyle: const TextStyle(color: AppColors.zinc400, fontSize: 12),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        ),
      ),
    );
  }

  void _submitLogin() async {
    final email = _loginEmailController.text.trim();
    final pass = _loginPasswordController.text.trim();

    if (email.isEmpty || pass.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Inserisci email e password per accedere')),
      );
      return;
    }

    final authRepo = context.read<AuthRepository>();
    final success = await authRepo.signInWithEmailPassword(email, pass);
    if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(authRepo.errorMessage ?? 'Errore durante l\'accesso')),
      );
    }
  }

  void _submitRegister() async {
    final name = _regNameController.text.trim();
    final email = _regEmailController.text.trim();
    final phone = _regPhoneController.text.trim();
    final pass = _regPasswordController.text.trim();

    if (name.isEmpty || email.isEmpty || pass.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Compila tutti i campi obbligatori')),
      );
      return;
    }

    final authRepo = context.read<AuthRepository>();
    final success = await authRepo.signUpWithEmailPassword(
      email: email,
      password: pass,
      displayName: name,
      phone: phone,
      role: _selectedRole,
      salonName: _regSalonNameController.text.trim().isNotEmpty ? _regSalonNameController.text.trim() : null,
      address: _regAddressController.text.trim().isNotEmpty ? _regAddressController.text.trim() : null,
    );

    if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(authRepo.errorMessage ?? 'Errore durante la registrazione')),
      );
    }
  }
}
