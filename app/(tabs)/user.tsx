import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
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

export default function UserScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
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
  const MAPBOX_API_KEY =
    'pk.eyJ1Ijoic2FuanUxNSIsImEiOiJjbWUxMGR4bWMwYmE3Mmpwcmo1cmE5eW40In0._JC7w64EKxzPNMCaIrUgqA';
  const [routeCoords, setRouteCoords] = useState([]);

  const router = useRouter();

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (location) {
      updateAddress();
    }
  }, [location]);

  useEffect(() => {
    const SOCKET_URL = 'http://51.21.221.235'; // Use your backend IP
    const connectSocket = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const s = io(SOCKET_URL, { transports: ['websocket'] });
      s.on('connect', () => {
        s.emit('join', { token });
      });
      s.on('agentLocation', (data) => {
        setAgentLocation({
          latitude: data.latitude,
          longitude: data.longitude,
        });
      });
      setSocket(s);
    };
    connectSocket();
    return () => {
      socket?.disconnect();
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (location && isTracking) {
      sendLocation(location.coords.latitude, location.coords.longitude);
    }
    // eslint-disable-next-line
  }, [location, isTracking]);

  // When agentLocation or isTrackingAgent changes, update map region
  useEffect(() => {
    if (isTrackingAgent && agentLocation) {
      setMapRegion({
        latitude: agentLocation.latitude,
        longitude: agentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } else if (location) {
      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [isTrackingAgent, agentLocation, location]);

  // Fetch directions whenever location or agentLocation changes and showMap is true
  useEffect(() => {
    if (showMap && location && agentLocation) {
      const fetchRoute = async () => {
        const from = `${location.coords.longitude},${location.coords.latitude}`;
        const to = `${agentLocation.longitude},${agentLocation.latitude}`;
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from};${to}?geometries=geojson&access_token=${MAPBOX_API_KEY}`;
        try {
          const res = await fetch(url);
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            setRouteCoords(
              data.routes[0].geometry.coordinates.map(
                ([lng, lat]: [number, number]) => ({
                  latitude: lat,
                  longitude: lng,
                })
              )
            );
          } else {
            setRouteCoords([]);
          }
        } catch {
          setRouteCoords([]);
        }
      };
      fetchRoute();
    } else {
      setRouteCoords([]);
    }
  }, [showMap, location, agentLocation]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status === 'granted') {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(currentLocation);
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setHasPermission(false);
    } finally {
      setIsLoading(false);
    }
  };

  const updateAddress = async () => {
    if (!location) return;

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
      return;
    }

    try {
      setIsTracking(true);
      await LocationTracking.startTracking((newLocation) => {
        setLocation(newLocation);
      });
    } catch (error) {
      console.error('Error starting tracking:', error);
      setIsTracking(false);
    }
  };

  const stopTracking = () => {
    LocationTracking.stopTracking();
    setIsTracking(false);
  };

  const sendLocation = (lat: number, lng: number) => {
    if (socket) {
      socket.emit('location', { latitude: lat, longitude: lng });
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/login');
  };

  if (isLoading) {
    return <LoadingScreen message="Initializing location services..." />;
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>User Dashboard</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleLogout}>
          <Text style={{ color: '#DC3545', fontWeight: 'bold' }}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        {location && (
          <MapView style={{ flex: 1 }} region={mapRegion}>
            <Marker
              coordinate={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }}
              title="You"
              pinColor="#007AFF"
            />
            {isTrackingAgent && agentLocation && (
              <Marker
                coordinate={agentLocation}
                title="Delivery Agent"
                pinColor="#FF3B30"
              />
            )}
          </MapView>
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

        {location && (
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
});
