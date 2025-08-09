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
import { MapComponent } from '@/components/MapComponent';
import { MapPin, Play, Square, Navigation } from 'lucide-react-native';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { View as RNView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';

export default function UserScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [address, setAddress] = useState<string>('');
  const [agentLocation, setAgentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [isTrackingAgent, setIsTrackingAgent] = useState(false);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [showMap, setShowMap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const MAPBOX_API_KEY =
    'pk.eyJ1Ijoic2FuanUxNSIsImEiOiJjbWUxMGR4bWMwYmE3Mmpwcmo1cmE5eW40In0._JC7w64EKxzPNMCaIrUgqA';
  const [routeCoords, setRouteCoords] = useState([]);

  const router = useRouter();

  const requestLocationPermission = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings to use this app.',
          [{ text: 'OK', onPress: () => setHasPermission(false) }]
        );
        setHasPermission(false);
        setIsLoading(false);
        return;
      }

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status === 'granted') {
        try {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (currentLocation && currentLocation.coords) {
            setLocation(currentLocation);
          }
        } catch (locationError) {
          console.error('Error getting current location:', locationError);
          setHasPermission(true);
          Alert.alert(
            'Location Unavailable',
            'Unable to get your current location. The app will continue to work, but location features may be limited.',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          'Location Permission Required',
          'This app needs location permission to share your location with delivery agents. Please grant permission in settings.',
          [{ text: 'OK', onPress: () => setHasPermission(false) }]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setHasPermission(false);
      setError('Failed to request location permission');
      Alert.alert(
        'Location Error',
        'There was an error accessing location services. Please try again.',
        [{ text: 'OK' }]
      );
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
    if (location && location.coords) {
      updateAddress();
    }
  }, [location]);

  useEffect(() => {
    const SOCKET_URL = Constants.expoConfig?.extra?.apiUrl;
    if (!SOCKET_URL) {
      console.warn('Socket URL not configured');
      return;
    }

    let socketInstance: any = null;

    const connectSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          console.log('No token found, skipping socket connection');
          return;
        }
        
        socketInstance = io(SOCKET_URL, { 
          transports: ['websocket'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });
        
        socketInstance.on('connect', () => {
          console.log('Socket connected');
          try {
            socketInstance.emit('join', { token });
          } catch (error) {
            console.error('Error emitting join event:', error);
          }
        });
        
        socketInstance.on('connect_error', (error: any) => {
          console.error('Socket connection error:', error);
        });
        
        socketInstance.on('disconnect', (reason: string) => {
          console.log('Socket disconnected:', reason);
        });
        
        socketInstance.on('agentLocation', (data: any) => {
          try {
            if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number' && 
                !isNaN(data.latitude) && !isNaN(data.longitude)) {
              setAgentLocation({
                latitude: data.latitude,
                longitude: data.longitude,
              });
            }
          } catch (error) {
            console.error('Error processing agent location:', error);
          }
        });
        
        setSocket(socketInstance);
      } catch (error) {
        console.error('Error connecting to socket:', error);
      }
    };
    
    connectSocket();
    
    return () => {
      if (socketInstance) {
        try {
          socketInstance.disconnect();
        } catch (error) {
          console.error('Error disconnecting socket:', error);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (location && location.coords && isTracking) {
      sendLocation(location.coords.latitude, location.coords.longitude);
    }
  }, [location, isTracking]);

  useEffect(() => {
    if (isTrackingAgent && agentLocation) {
      setMapRegion({
        latitude: agentLocation.latitude,
        longitude: agentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } else if (location && location.coords) {
      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [isTrackingAgent, agentLocation, location]);

  const updateAddress = async () => {
    if (!location || !location.coords) return;

    try {
      const addressResult = await LocationTracking.getLocationAddress(
        location.coords.latitude,
        location.coords.longitude
      );
      setAddress(addressResult);
    } catch (error) {
      console.error('Error getting address:', error);
    }
  };

  const startTracking = async () => {
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Location permission is required to start tracking.');
      return;
    }

    try {
      setIsTracking(true);
      await LocationTracking.startTracking((newLocation) => {
        if (newLocation && newLocation.coords) {
          setLocation(newLocation);
        }
      });
    } catch (error) {
      console.error('Error starting tracking:', error);
      setIsTracking(false);
      Alert.alert('Tracking Error', 'Failed to start location tracking. Please try again.');
    }
  };

  const stopTracking = () => {
    try {
      LocationTracking.stopTracking();
      setIsTracking(false);
    } catch (error) {
      console.error('Error stopping tracking:', error);
    }
  };

  const sendLocation = (lat: number, lng: number) => {
    if (socket && typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      try {
        socket.emit('location', { latitude: lat, longitude: lng });
      } catch (error) {
        console.error('Error sending location:', error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      router.replace('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      Alert.alert('Logout Error', 'Failed to logout. Please try again.');
    }
  };

  // Add error boundary for component
  if (isLoading) {
    return <LoadingScreen message="Initializing location services..." />;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={requestLocationPermission}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <PermissionScreen
        title="Location Permission Required"
        description="This app needs location permission to share your location with delivery agents."
        onRetry={requestLocationPermission}
      />
    );
  }

  // Validate mapRegion before rendering
  const isValidMapRegion = mapRegion && 
    typeof mapRegion.latitude === 'number' && 
    typeof mapRegion.longitude === 'number' && 
    !isNaN(mapRegion.latitude) && 
    !isNaN(mapRegion.longitude) &&
    typeof mapRegion.latitudeDelta === 'number' && 
    typeof mapRegion.longitudeDelta === 'number';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>User Dashboard</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleLogout}>
          <Text style={{ color: '#DC3545', fontWeight: 'bold' }}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        {location && location.coords && isValidMapRegion && 
         typeof location.coords.latitude === 'number' && 
         typeof location.coords.longitude === 'number' && 
         !isNaN(location.coords.latitude) && 
         !isNaN(location.coords.longitude) ? (
          <MapView 
            style={{ flex: 1 }} 
            region={mapRegion}
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            <Marker
              coordinate={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }}
              title="You"
              pinColor="#007AFF"
            />
            {isTrackingAgent && agentLocation && 
             typeof agentLocation.latitude === 'number' && 
             typeof agentLocation.longitude === 'number' && 
             !isNaN(agentLocation.latitude) && 
             !isNaN(agentLocation.longitude) && (
              <Marker
                coordinate={agentLocation}
                title="Delivery Agent"
                pinColor="#FF3B30"
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
        {!isTracking && (
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={startTracking}
          >
            <Text style={styles.buttonText}>Share My Location</Text>
          </TouchableOpacity>
        )}
        {isTracking && !showMap && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#007AFF' }]}
            onPress={() => setShowMap(true)}
            disabled={!agentLocation}
          >
            <Text style={styles.buttonText}>Track My Order</Text>
          </TouchableOpacity>
        )}
        {showMap && agentLocation && (
          <View style={{ flex: 1 }}>
            <MapView
              style={{ flex: 1 }}
              region={{
                latitude: agentLocation.latitude,
                longitude: agentLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              {/* User's own marker as a circle */}
              {location && (
                <Marker
                  coordinate={{
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                  }}
                  title="You: Delivery Boy"
                >
                  <RNView
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: '#007AFF88',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 2,
                      borderColor: '#007AFF',
                    }}
                  />
                </Marker>
              )}
              {/* Agent's marker as a location symbol */}
              <Marker coordinate={agentLocation} title="Customer">
                <MaterialIcons name="location-on" size={36} color="#FF3B30" />
              </Marker>
              {/* Draw route if available */}
              {routeCoords.length > 0 && (
                <Polyline
                  coordinates={routeCoords}
                  strokeColor="#007AFF"
                  strokeWidth={4}
                />
              )}
            </MapView>
          </View>
        )}

        {location && location.coords && 
         typeof location.coords.latitude === 'number' && 
         typeof location.coords.longitude === 'number' && 
         !isNaN(location.coords.latitude) && 
         !isNaN(location.coords.longitude) && (
          <View style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <Navigation size={16} color="#007AFF" />
              <Text style={styles.locationTitle}>Current Location</Text>
            </View>

            {address && <Text style={styles.addressText}>{address}</Text>}

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
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6C757D',
    lineHeight: 22,
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  noLocationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  noLocationText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6C757D',
  },
  controls: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  startButton: {
    backgroundColor: '#28A745',
  },
  stopButton: {
    backgroundColor: '#DC3545',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
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
    lineHeight: 22,
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
  accuracyText: {
    fontSize: 12,
    color: '#28A745',
    fontWeight: '500',
  },
  refreshButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DC3545',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  mapPlaceholderText: {
    fontSize: 18,
    color: '#6C757D',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#DC3545',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
