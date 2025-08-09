import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { LocationTracking } from '@/services/LocationTracking';
import { LoadingScreen } from '@/components/LoadingScreen';
import { PermissionScreen } from '@/components/PermissionScreen';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import io, { Socket } from 'socket.io-client';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export default function UserScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [isTracking, setIsTracking] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [address, setAddress] = useState<string>('');
  const [agentLocation, setAgentLocation] = useState<Coordinates | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [mapRegion, setMapRegion] = useState<MapRegion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [routeCoords, setRouteCoords] = useState<Coordinates[]>([]);

  const router = useRouter();
  const SOCKET_URL = 'http://51.21.221.235:5000';
  const MAPBOX_API_KEY =
    'pk.eyJ1Ijoic2FuanUxNSIsImEiOiJjbWUxMGR4bWMwYmE3Mmpwcmo1cmE5eW40In0._JC7w64EKxzPNMCaIrUgqA';

  const requestLocationPermission = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);

      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings.',
          [{ text: 'OK', onPress: () => setHasPermission(false) }]
        );
        setHasPermission(false);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status === 'granted') {
        const currentLocation = await LocationTracking.getCurrentLocation();
        if (currentLocation) {
          setLocation(currentLocation);
          setMapRegion({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        } else {
          Alert.alert('Error', 'Unable to get current location.');
        }
      } else {
        Alert.alert(
          'Permission Denied',
          'Location permission is required. Please grant it in settings.',
          [{ text: 'OK', onPress: () => setHasPermission(false) }]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setError('Failed to request location permission');
      Alert.alert('Error', 'Unable to access location services.');
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      requestLocationPermission();
    }
  }, [isInitialized, requestLocationPermission]);

  useEffect(() => {
    if (location?.coords) {
      updateAddress();
    }
  }, [location]);

  // Socket connection setup with join event
  useEffect(() => {
    if (!SOCKET_URL) {
      console.error('Socket URL not configured');
      setError('Server configuration missing');
      return;
    }

    let socketInstance: Socket | null = null;

    const connectSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          console.warn('No token found');
          Alert.alert('Authentication Error', 'Please log in again.');
          router.replace('/login');
          return;
        }

        socketInstance = io(SOCKET_URL, {
          transports: ['websocket'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          auth: { token },
        });

        socketInstance.on('connect', () => {
          console.log('Socket connected:', socketInstance?.id);
          // Emit join event with token for authentication and role setup on backend
          socketInstance?.emit('join', { token });
        });

        socketInstance.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          setError('Failed to connect to server');
        });

        socketInstance.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
        });

        // Listen for agent location updates
        socketInstance.on('agentLocation', (data: Coordinates) => {
          if (
            data?.latitude != null &&
            data?.longitude != null &&
            !isNaN(data.latitude) &&
            !isNaN(data.longitude)
          ) {
            setAgentLocation(data);
            setMapRegion({
              latitude: data.latitude,
              longitude: data.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
            if (location?.coords) {
              fetchRoute(location.coords, data);
            }
          }
        });

        setSocket(socketInstance);
      } catch (error) {
        console.error('Socket setup error:', error);
        setError('Failed to initialize connection');
      }
    };

    connectSocket();

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [SOCKET_URL, location]);

  useEffect(() => {
    if (isTracking && location?.coords && socket) {
      sendLocation(location.coords.latitude, location.coords.longitude);
    }
  }, [location, isTracking, socket]);

  const updateAddress = async () => {
    if (!location?.coords) return;

    try {
      const addressResult = await LocationTracking.getLocationAddress(
        location.coords.latitude,
        location.coords.longitude
      );
      setAddress(addressResult);
    } catch (error) {
      console.error('Error getting address:', error);
      setAddress('Unable to fetch address');
    }
  };

  const fetchRoute = async (start: Coordinates, end: Coordinates) => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?geometries=geojson&access_token=${MAPBOX_API_KEY}`
      );
      const data = await response.json();
      if (data.routes?.[0]?.geometry) {
        const coords = data.routes[0].geometry.coordinates.map(
          ([lng, lat]: [number, number]) => ({
            latitude: lat,
            longitude: lng,
          })
        );
        setRouteCoords(coords);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    }
  };

  const startTracking = async () => {
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Location permission is needed.');
      return;
    }

    try {
      setIsTracking(true);
      await LocationTracking.startTracking((newLocation) => {
        if (newLocation?.coords) {
          setLocation(newLocation);
          setMapRegion({
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      });
    } catch (error) {
      console.error('Error starting tracking:', error);
      setIsTracking(false);
      Alert.alert('Error', 'Failed to start location tracking.');
    }
  };

  const stopTracking = () => {
    try {
      LocationTracking.stopTracking();
      setIsTracking(false);
    } catch (error) {
      console.error('Error stopping tracking:', error);
      Alert.alert('Error', 'Failed to stop tracking.');
    }
  };

  const sendLocation = (lat: number, lng: number) => {
    if (socket && !isNaN(lat) && !isNaN(lng)) {
      socket.emit('location', { latitude: lat, longitude: lng });
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      if (socket) socket.disconnect();
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout.');
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Initializing location services..." />;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={requestLocationPermission}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <PermissionScreen
        title="Location Permission Required"
        description="This app needs location permission to share your location."
        onRetry={requestLocationPermission}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>User Dashboard</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleLogout}>
          <Text style={{ color: '#DC3545', fontWeight: 'bold' }}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        {mapRegion ? (
          <MapView
            style={{ flex: 1 }}
            region={mapRegion}
            showsUserLocation
            showsMyLocationButton
          >
            {location?.coords && (
              <Marker
                coordinate={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }}
                title="You"
                pinColor="#007AFF"
              />
            )}
            {agentLocation && (
              <Marker
                coordinate={agentLocation}
                title="Delivery Agent"
                pinColor="#FF3B30"
              >
                <MaterialIcons name="location-on" size={36} color="#FF3B30" />
              </Marker>
            )}
            {routeCoords.length > 0 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor="#007AFF"
                strokeWidth={4}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>Loading map...</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        {!isTracking ? (
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={startTracking}
          >
            <Text style={styles.buttonText}>Share My Location</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={stopTracking}
          >
            <Text style={styles.buttonText}>Stop Sharing</Text>
          </TouchableOpacity>
        )}

        {location?.coords && (
          <View style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <MaterialIcons name="location-on" size={16} color="#007AFF" />
              <Text style={styles.locationTitle}>Current Location</Text>
            </View>
            <Text style={styles.addressText}>
              {address || 'Fetching address...'}
            </Text>
            <View style={styles.coordinatesContainer}>
              <Text style={styles.coordText}>
                {location.coords.latitude.toFixed(6)},{' '}
                {location.coords.longitude.toFixed(6)}
              </Text>
              <Text style={styles.accuracyText}>
                ±{location.coords.accuracy?.toFixed(0) || '?'}m accuracy
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    backgroundColor: '#FFF',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 32, fontWeight: '700', color: '#212529' },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    elevation: 5,
  },
  controls: {
    backgroundColor: '#FFF',
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  startButton: { backgroundColor: '#28A745' },
  stopButton: { backgroundColor: '#DC3545' },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  locationCard: {
    backgroundColor: '#F8F9FA',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginLeft: 8,
  },
  addressText: {
    fontSize: 16,
    color: '#212529',
    fontWeight: '500',
    marginBottom: 12,
  },
  coordinatesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coordText: {
    fontSize: 14,
    color: '#6C757D',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  accuracyText: { fontSize: 12, color: '#28A745', fontWeight: '500' },
  refreshButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  mapPlaceholderText: { fontSize: 18, color: '#6C757D' },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  errorText: {
    color: '#DC3545',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  retryButtonText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
});
