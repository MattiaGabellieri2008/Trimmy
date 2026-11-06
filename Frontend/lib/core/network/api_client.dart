import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import '../storage/secure_storage_service.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final dynamic details;

  const ApiException({
    required this.statusCode,
    required this.message,
    this.details,
  });

  @override
  String toString() => 'ApiException [$statusCode]: $message';
}

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  // URL del backend Cloud Run / Next.js
  String _baseUrl = 'https://trimmy--gestionale-saloni.europe-west4.hosted.app';
  String? _authToken;

  static const String _tokenStorageKey = 'trimmy_api_bearer_token';
  static const Duration _defaultTimeout = Duration(seconds: 10);

  String get baseUrl => _baseUrl;
  String? get authToken => _authToken;
  bool get hasToken => _authToken != null && _authToken!.isNotEmpty;

  void setBaseUrl(String url) {
    _baseUrl = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }

  /// Inizializza il client caricando l'eventuale token salvato su storage sicuro (Keystore/Keychain)
  Future<void> init() async {
    try {
      _authToken = await SecureStorageService().readSecure(_tokenStorageKey);
    } catch (e) {
      debugPrint('Errore lettura protetta token ApiClient: $e');
    }
  }

  /// Salva o rimuove il Bearer token di autenticazione su storage hardware protetto
  Future<void> setAuthToken(String? token) async {
    _authToken = token;
    try {
      if (token != null && token.isNotEmpty) {
        await SecureStorageService().writeSecure(_tokenStorageKey, token);
      } else {
        await SecureStorageService().deleteSecure(_tokenStorageKey);
      }
    } catch (e) {
      debugPrint('Errore scrittura protetta token ApiClient: $e');
    }
  }

  Future<void> clearAuthToken() => setAuthToken(null);

  Future<Map<String, String>> _buildHeaders() async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // 1. Prova prima a recuperare il vero Firebase Auth ID Token valido in tempo reale
    try {
      final fbUser = FirebaseAuth.instance.currentUser;
      if (fbUser != null) {
        final idToken = await fbUser.getIdToken();
        if (idToken != null && idToken.isNotEmpty) {
          headers['Authorization'] = 'Bearer $idToken';
          return headers;
        }
      }
    } catch (e) {
      debugPrint('Nota recupero Firebase ID Token: $e');
    }

    // 2. Fallback su token memorizzato se presente
    if (_authToken != null && _authToken!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_authToken';
    }
    return headers;
  }

  Uri _buildUri(String path, [Map<String, dynamic>? queryParams]) {
    final cleanPath = path.startsWith('/') ? path : '/$path';
    final fullUrl = '$_baseUrl$cleanPath';
    final uri = Uri.parse(fullUrl);
    if (queryParams != null && queryParams.isNotEmpty) {
      final mapped = queryParams.map((k, v) => MapEntry(k, v.toString()));
      return uri.replace(queryParameters: mapped);
    }
    return uri;
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? queryParams}) async {
    try {
      final uri = _buildUri(path, queryParams);
      final headers = await _buildHeaders();
      final res = await http.get(uri, headers: headers).timeout(_defaultTimeout);
      return _processResponse(res);
    } on SocketException catch (e) {
      throw ApiException(statusCode: 0, message: 'Nessuna connessione a Internet: ${e.message}');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: 'Errore di rete: $e');
    }
  }

  Future<dynamic> post(String path, {dynamic body}) async {
    try {
      final uri = _buildUri(path);
      final headers = await _buildHeaders();
      final encodedBody = body != null ? jsonEncode(body) : null;
      final res = await http.post(uri, headers: headers, body: encodedBody).timeout(_defaultTimeout);
      return _processResponse(res);
    } on SocketException catch (e) {
      throw ApiException(statusCode: 0, message: 'Nessuna connessione a Internet: ${e.message}');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: 'Errore richiesta POST: $e');
    }
  }

  Future<dynamic> put(String path, {dynamic body}) async {
    try {
      final uri = _buildUri(path);
      final headers = await _buildHeaders();
      final encodedBody = body != null ? jsonEncode(body) : null;
      final res = await http.put(uri, headers: headers, body: encodedBody).timeout(_defaultTimeout);
      return _processResponse(res);
    } on SocketException catch (e) {
      throw ApiException(statusCode: 0, message: 'Nessuna connessione a Internet: ${e.message}');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: 'Errore richiesta PUT: $e');
    }
  }

  Future<dynamic> delete(String path) async {
    try {
      final uri = _buildUri(path);
      final headers = await _buildHeaders();
      final res = await http.delete(uri, headers: headers).timeout(_defaultTimeout);
      return _processResponse(res);
    } on SocketException catch (e) {
      throw ApiException(statusCode: 0, message: 'Nessuna connessione a Internet: ${e.message}');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: 'Errore richiesta DELETE: $e');
    }
  }

  dynamic _processResponse(http.Response res) {
    dynamic decoded;
    try {
      if (res.body.isNotEmpty) {
        decoded = jsonDecode(res.body);
      }
    } catch (_) {
      decoded = res.body;
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return decoded;
    }

    String errorMsg = 'Richiesta non riuscita (${res.statusCode})';
    if (decoded is Map && decoded['error'] != null) {
      errorMsg = decoded['error'].toString();
    } else if (decoded is Map && decoded['message'] != null) {
      errorMsg = decoded['message'].toString();
    }

    throw ApiException(
      statusCode: res.statusCode,
      message: errorMsg,
      details: decoded,
    );
  }
}
