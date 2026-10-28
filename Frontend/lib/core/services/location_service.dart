import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

enum LocationPermissionResult {
  granted,
  denied,
  deniedForever,
  serviceDisabled,
}

class UserLocation {
  final double latitude;
  final double longitude;
  final String? cityName;
  final bool isGpsFix;

  const UserLocation({
    required this.latitude,
    required this.longitude,
    this.cityName,
    this.isGpsFix = true,
  });
}

class LocationService extends ChangeNotifier {
  UserLocation? _currentLocation;
  bool _isLocating = false;
  String _selectedCity = 'Milano';
  String? _lastErrorMessage;

  UserLocation? get currentLocation => _currentLocation;
  bool get isLocating => _isLocating;
  String get selectedCity => _selectedCity;
  String? get lastErrorMessage => _lastErrorMessage;
  bool get hasLocation => _currentLocation != null;
  bool get isGpsActive => _currentLocation?.isGpsFix ?? false;

  // Coordinate di riferimento per le città italiane predefinite (fallback immediato)
  static const Map<String, UserLocation> cityPresets = {
    'Milano': UserLocation(latitude: 45.4642, longitude: 9.1900, cityName: 'Milano', isGpsFix: false),
    'Roma': UserLocation(latitude: 41.9028, longitude: 12.4964, cityName: 'Roma', isGpsFix: false),
    'Torino': UserLocation(latitude: 45.0703, longitude: 7.6869, cityName: 'Torino', isGpsFix: false),
    'Bologna': UserLocation(latitude: 44.4949, longitude: 11.3426, cityName: 'Bologna', isGpsFix: false),
    'Firenze': UserLocation(latitude: 43.7696, longitude: 11.2558, cityName: 'Firenze', isGpsFix: false),
    'Napoli': UserLocation(latitude: 40.8518, longitude: 14.2681, cityName: 'Napoli', isGpsFix: false),
  };

  LocationService() {
    // Inizializza con la città predefinita (Milano)
    _currentLocation = cityPresets['Milano'];
  }

  /// Imposta manualmente una città dal selettore
  void setCity(String city) {
    if (cityPresets.containsKey(city)) {
      _selectedCity = city;
      _currentLocation = cityPresets[city];
      _lastErrorMessage = null;
      notifyListeners();
    }
  }

  /// Richiede il permesso GPS e acquisisce la posizione runtime
  Future<LocationPermissionResult> requestLocation() async {
    _isLocating = true;
    _lastErrorMessage = null;
    notifyListeners();

    try {
      // 1. Verifica se i servizi di localizzazione del dispositivo sono attivi
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _isLocating = false;
        _lastErrorMessage = 'I servizi di localizzazione (GPS) sono disattivati sul tuo dispositivo.';
        notifyListeners();
        return LocationPermissionResult.serviceDisabled;
      }

      // 2. Controllo e richiesta formale del permesso
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          _isLocating = false;
          _lastErrorMessage = 'Permesso di localizzazione rifiutato.';
          notifyListeners();
          return LocationPermissionResult.denied;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        _isLocating = false;
        _lastErrorMessage = 'I permessi di localizzazione sono stati negati permanentemente. Puoi abilitarli nelle impostazioni dell\'app.';
        notifyListeners();
        return LocationPermissionResult.deniedForever;
      }

      // 3. Acquisizione coordinate effettive con timeout
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 8),
        ),
      );

      _currentLocation = UserLocation(
        latitude: position.latitude,
        longitude: position.longitude,
        cityName: 'Posizione GPS Attuale',
        isGpsFix: true,
      );
      _selectedCity = 'Vicino a me (GPS)';
      _isLocating = false;
      notifyListeners();
      return LocationPermissionResult.granted;
    } catch (e) {
      _isLocating = false;
      _lastErrorMessage = 'Impossibile rilevare la posizione GPS.';
      notifyListeners();
      return LocationPermissionResult.denied;
    }
  }

  /// Calcola la distanza in metri tra la posizione dell'utente e il salone
  double? calculateDistanceTo(double? targetLat, double? targetLng) {
    if (_currentLocation == null || targetLat == null || targetLng == null) {
      return null;
    }
    return Geolocator.distanceBetween(
      _currentLocation!.latitude,
      _currentLocation!.longitude,
      targetLat,
      targetLng,
    );
  }

  /// Formatta la distanza in stringa leggibile (es. "450 m" o "1.8 km")
  String formatDistance(double? targetLat, double? targetLng) {
    final meters = calculateDistanceTo(targetLat, targetLng);
    if (meters == null) return '';
    if (meters < 1000) {
      return '${meters.toInt()} m';
    } else {
      return '${(meters / 1000).toStringAsFixed(1)} km';
    }
  }

  /// Apre le impostazioni di sistema dell'app se i permessi sono disabilitati permanentemente
  Future<bool> openSettings() async {
    return await Geolocator.openAppSettings();
  }
}

