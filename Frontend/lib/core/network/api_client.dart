import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

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

  /// Inizializza il client caricando l'eventuale token salvato su disco
  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _authToken = prefs.getString(_tokenStorageKey);
    } catch (e) {
      debugPrint('Errore lettura token ApiClient: $e');
    }
  }

  /// Salva o rimuove il Bearer token di autenticazione
  Future<void> setAuthToken(String? token) async {
    _authToken = token;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (token != null && token.isNotEmpty) {
        await prefs.setString(_tokenStorageKey, token);
      } else {
        await prefs.remove(_tokenStorageKey);
      }
    } catch (e) {
      debugPrint('Errore scrittura token ApiClient: $e');
    }
  }

  Map<String, String> _buildHeaders() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
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
      final res = await http.get(uri, headers: _buildHeaders()).timeout(_defaultTimeout);
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
      final encodedBody = body != null ? jsonEncode(body) : null;
      final res = await http.post(uri, headers: _buildHeaders(), body: encodedBody).timeout(_defaultTimeout);
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
      final encodedBody = body != null ? jsonEncode(body) : null;
      final res = await http.put(uri, headers: _buildHeaders(), body: encodedBody).timeout(_defaultTimeout);
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
      final res = await http.delete(uri, headers: _buildHeaders()).timeout(_defaultTimeout);
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
