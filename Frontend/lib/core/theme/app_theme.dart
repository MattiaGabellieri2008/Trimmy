import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_colors.dart';

/// Tema Globale Material 3 di Trimmy Mobile
class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      primaryColor: AppColors.obsidianBlack,
      scaffoldBackgroundColor: AppColors.zinc50,
      fontFamily: 'Inter',
      colorScheme: const ColorScheme.light(
        primary: AppColors.obsidianBlack,
        secondary: AppColors.gold,
        surface: AppColors.white,
        error: AppColors.rose,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.white,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        iconTheme: IconThemeData(color: AppColors.zinc900),
        titleTextStyle: TextStyle(
          color: AppColors.zinc900,
          fontSize: 18,
          fontWeight: FontWeight.bold,
          letterSpacing: -0.5,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.zinc200, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.obsidianBlack,
          foregroundColor: AppColors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            letterSpacing: -0.2,
          ),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.white,
        selectedItemColor: AppColors.obsidianBlack,
        unselectedItemColor: AppColors.zinc400,
        selectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
        unselectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      primaryColor: AppColors.white,
      scaffoldBackgroundColor: AppColors.obsidianBlack,
      fontFamily: 'Inter',
      colorScheme: const ColorScheme.dark(
        primary: AppColors.white,
        secondary: AppColors.gold,
        surface: AppColors.zinc900,
        error: AppColors.rose,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.obsidianBlack,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        iconTheme: IconThemeData(color: AppColors.white),
        titleTextStyle: TextStyle(
          color: AppColors.white,
          fontSize: 18,
          fontWeight: FontWeight.bold,
          letterSpacing: -0.5,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.zinc900,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.zinc800, width: 1),
        ),
      ),
    );
  }
}
