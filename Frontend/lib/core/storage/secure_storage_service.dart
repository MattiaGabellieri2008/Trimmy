import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Servizio di archiviazione crittografata hardware (Keystore Android / Keychain iOS)
/// Implementa migrazione automatica sicura dai vecchi SharedPreferences in chiaro.
class SecureStorageService {
  static final SecureStorageService _instance = SecureStorageService._internal();
  factory SecureStorageService() => _instance;
  SecureStorageService._internal();

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      resetOnError: true,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock,
    ),
  );

  /// Legge un valore crittografato, con migrazione trasparente da SharedPreferences se presente
  Future<String?> readSecure(String key) async {
    try {
      final secureVal = await _storage.read(key: key);
      if (secureVal != null && secureVal.isNotEmpty) {
        return secureVal;
      }

      // Migrazione legacy da SharedPreferences
      final prefs = await SharedPreferences.getInstance();
      final legacyVal = prefs.getString(key);
      if (legacyVal != null && legacyVal.isNotEmpty) {
        await _storage.write(key: key, value: legacyVal);
        await prefs.remove(key); // Rimuove il dato in chiaro
        debugPrint('[SecureStorage] Migrato con successo $key dal plaintext al Keystore/Keychain.');
        return legacyVal;
      }
    } catch (e) {
      debugPrint('[SecureStorage] Errore lettura protetta per $key: $e');
    }
    return null;
  }

  /// Salva un valore cifrato con chiavi gestite a livello hardware dal sistema operativo
  Future<void> writeSecure(String key, String value) async {
    try {
      await _storage.write(key: key, value: value);
      // Assicura che non sia rimasto nei vecchi SharedPreferences
      final prefs = await SharedPreferences.getInstance();
      if (prefs.containsKey(key)) {
        await prefs.remove(key);
      }
    } catch (e) {
      debugPrint('[SecureStorage] Errore scrittura protetta per $key: $e');
    }
  }

  /// Cancella un dato crittografato
  Future<void> deleteSecure(String key) async {
    try {
      await _storage.delete(key: key);
      final prefs = await SharedPreferences.getInstance();
      if (prefs.containsKey(key)) {
        await prefs.remove(key);
      }
    } catch (e) {
      debugPrint('[SecureStorage] Errore eliminazione protetta per $key: $e');
    }
  }

  /// Pulisce l'intero storage crittografato (es. al logout o eliminazione account)
  Future<void> clearAll() async {
    try {
      await _storage.deleteAll();
    } catch (e) {
      debugPrint('[SecureStorage] Errore svuotamento totale storage sicuro: $e');
    }
  }
}
