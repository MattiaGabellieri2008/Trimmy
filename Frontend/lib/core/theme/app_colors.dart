import 'package:flutter/material.dart';

/// Palette Colori Ufficiale di Trimmy Mobile
/// Allineata al Design System di lusso della Web App
class AppColors {
  // Brand Neutrals
  static const Color obsidianBlack = Color(0xFF09090B);
  static const Color zinc900 = Color(0xFF18181B);
  static const Color zinc800 = Color(0xFF27272A);
  static const Color zinc700 = Color(0xFF3F3F46);
  static const Color zinc600 = Color(0xFF52525B);
  static const Color zinc500 = Color(0xFF71717A);
  static const Color zinc400 = Color(0xFFA1A1AA);
  static const Color zinc300 = Color(0xFFD4D4D8);
  static const Color zinc200 = Color(0xFFE4E4E7);
  static const Color zinc100 = Color(0xFFF4F4F5);
  static const Color zinc50 = Color(0xFFFAFAFA);
  static const Color white = Color(0xFFFFFFFF);

  // Accenti Primari
  static const Color gold = Color(0xFFD97706);
  static const Color goldLight = Color(0xFFF59E0B);
  static const Color goldSurface = Color(0xFFFEF3C7);

  // Accenti Funzionali
  static const Color indigo = Color(0xFF4F46E5);
  static const Color indigoLight = Color(0xFFEEF2FF);
  
  static const Color emerald = Color(0xFF059669);
  static const Color emeraldLight = Color(0xFFECFDF5);
  
  static const Color rose = Color(0xFFE11D48);
  static const Color roseLight = Color(0xFFFFE4E6);

  // Gradienti di Lusso
  static const LinearGradient luxuryCardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF09090B),
      Color(0xFF18181B),
      Color(0xFF27272A),
    ],
  );

  static const LinearGradient goldBadgeGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFD97706),
      Color(0xFFF59E0B),
    ],
  );
}
