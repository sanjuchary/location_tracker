import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { LocationTracking } from '@/services/LocationTracking';
import { LoadingScreen } from '@/components/LoadingScreen';
import { PermissionScreen } from '@/components/PermissionScreen';
import { Users, Map, RefreshCw } from 'lucide-react-native';
import io, { Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';

interface Coordinates {
  latitude: number;
  longitude: number;
}
interface UserLocation {
  userId: string;
  location: Coordinates;
  lastUpdated: number;
}
interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export default function AgentScreen() {
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [agentLocation, setAgentLocation] = useState<Coordinates | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
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
        if (currentLocation?.coords) {
          setAgentLocation({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });
        }
      } else {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to track users.',
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

  // Socket connection and join logic
  useEffect(() => {
    if (!SOCKET_URL) {
      console.error('Socket URL not configured');
      setError('Server configuration missing');
      return;
    }
    let socketInstance: Socket | null = null;
    let cleanupSocket: (() => void) | undefined;

    const connectSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
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
          console.log('Socket connected:', socketInstance!.id);
          // Required join handshake with your backend
          socketInstance!.emit('join', { token });
        });

        socketInstance.on('connect_error', (err) => {
          console.error('Socket connection error:', err);
          setError('Failed to connect to server');
        });

        socketInstance.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
        });

        // Listen for all user locations
        socketInstance.on(
          'userLocation',
          (data: {
            userId: string;
            latitude: number;
            longitude: number;
            updatedAt?: number;
          }) => {
            if (
              data?.userId &&
              typeof data.latitude === 'number' &&
              typeof data.longitude === 'number' &&
              !isNaN(data.latitude) &&
              !isNaN(data.longitude)
            ) {
              setUserLocations((prev) => {
                const existing = prev.find((u) => u.userId === data.userId);
                const updatedAt = data.updatedAt || Date.now();
                if (existing) {
                  return prev.map((u) =>
                    u.userId === data.userId
                      ? {
                          ...u,
                          location: {
                            latitude: data.latitude,
                            longitude: data.longitude,
                          },
                          lastUpdated: updatedAt,
                        }
                      : u
                  );
                }
                return [
                  ...prev,
                  {
                    userId: data.userId,
                    location: {
                      latitude: data.latitude,
                      longitude: data.longitude,
                    },
                    lastUpdated: updatedAt,
                  },
                ];
              });
            }
          }
        );

        setSocket(socketInstance);

        // Socket cleanup
        cleanupSocket = () => {
          socketInstance?.disconnect();
        };
      } catch (error) {
        console.error('Socket setup error:', error);
        setError('Failed to initialize connection');
      }
    };
    connectSocket();

    return () => {
      cleanupSocket && cleanupSocket();
    };
  }, [SOCKET_URL, router]);

  // Track agent's own location and broadcast to server
  useEffect(() => {
    if (hasPermission) {
      LocationTracking.startTracking((location) => {
        if (location?.coords) {
          setAgentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      }).catch((error) => {
        console.error('Error starting agent tracking:', error);
        setError('Failed to track agent location');
      });
      return () => {
        LocationTracking.stopTracking();
      };
    }
  }, [hasPermission]);

  useEffect(() => {
    if (agentLocation && socket) {
      socket.emit('location', {
        latitude: agentLocation.latitude,
        longitude: agentLocation.longitude,
      });
    }
  }, [agentLocation, socket]);

  // Route logic (shows driving directions between agent and selected user)
  useEffect(() => {
    if (agentLocation && selectedUserId) {
      const selectedUser = userLocations.find(
        (u) => u.userId === selectedUserId
      );
      if (selectedUser) {
        const fetchRoute = async () => {
          try {
            const from = `${selectedUser.location.longitude},${selectedUser.location.latitude}`;
            const to = `${agentLocation.longitude},${agentLocation.latitude}`;
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from};${to}?geometries=geojson&access_token=${MAPBOX_API_KEY}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            if (data.routes?.[0]?.geometry?.coordinates) {
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
          } catch (error) {
            console.error('Error fetching route:', error);
            setRouteCoords([]);
          }
        };
        fetchRoute();
      }
    } else {
      setRouteCoords([]);
    }
  }, [agentLocation, selectedUserId, userLocations, MAPBOX_API_KEY]);

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      // (Optional: API call to refresh data)
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error refreshing data:', error);
      Alert.alert('Error', 'Failed to refresh data.');
    }
    setIsRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      if (socket) socket.disconnect();
      LocationTracking.stopTracking();
      router.replace('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      Alert.alert('Error', 'Failed to logout.');
    }
  };

  const handleTrackUser = (userId: string) => {
    setSelectedUserId(userId);
    setViewMode('map');
  };

  if (isLoading) {
    return <LoadingScreen message="Loading agent dashboard..." />;
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
        description="This app needs location permission to show user locations and provide accurate tracking."
        onRetry={requestLocationPermission}
      />
    );
  }

  const renderListView = () => (
    <FlatList
      data={userLocations}
      keyExtractor={(item) => item.userId}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => handleTrackUser(item.userId)}
          style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}
        >
          <Text>User: {item.userId}</Text>
          <Text>
            Lat: {item.location.latitude.toFixed(6)}, Lng:{' '}
            {item.location.longitude.toFixed(6)}
          </Text>
          <Text style={{ color: '#007AFF', marginTop: 4 }}>
            {selectedUserId === item.userId ? 'Tracking' : 'Track'}
          </Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <Text style={{ textAlign: 'center', marginTop: 32, color: '#888' }}>
          No users are currently sharing their location.
        </Text>
      }
      refreshing={isRefreshing}
      onRefresh={refreshData}
    />
  );

  const getMapRegion = () => {
    if (selectedUserId && agentLocation) {
      const selectedUser = userLocations.find(
        (u) => u.userId === selectedUserId
      );
      if (selectedUser && agentLocation) {
        const lat =
          (selectedUser.location.latitude + agentLocation.latitude) / 2;
        const lng =
          (selectedUser.location.longitude + agentLocation.longitude) / 2;
        return {
          latitude: lat,
          longitude: lng,
          latitudeDelta:
            Math.abs(selectedUser.location.latitude - agentLocation.latitude) +
            0.01,
          longitudeDelta:
            Math.abs(
              selectedUser.location.longitude - agentLocation.longitude
            ) + 0.01,
        };
      }
    }
    if (agentLocation) {
      return {
        latitude: agentLocation.latitude,
        longitude: agentLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return {
      latitude: 37.78825,
      longitude: -122.4324,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  };

  const renderMapView = () => {
    const mapRegion = getMapRegion();
    if (isNaN(mapRegion.latitude) || isNaN(mapRegion.longitude)) {
      return (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>Loading map...</Text>
        </View>
      );
    }
    return (
      <MapView style={{ flex: 1 }} region={mapRegion}>
        {agentLocation && (
          <Marker coordinate={agentLocation} title="You: Agent">
            <View
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
        {userLocations.map((user) => (
          <Marker
            key={user.userId}
            coordinate={user.location}
            title={`User ${user.userId}`}
            pinColor={selectedUserId === user.userId ? '#FF3B30' : '#FFA500'}
          >
            <MaterialIcons
              name="location-on"
              size={36}
              color={selectedUserId === user.userId ? '#FF3B30' : '#FFA500'}
            />
          </Marker>
        ))}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#007AFF"
            strokeWidth={3}
          />
        )}
      </MapView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Agent Dashboard</Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refreshData}
            >
              <RefreshCw size={20} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleLogout}
            >
              <Text style={{ color: '#DC3545', fontWeight: 'bold' }}>
                Logout
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {userLocations.length} active delivery • {userLocations.length} total
          users
        </Text>
      </View>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === 'list' && styles.activeToggle,
          ]}
          onPress={() => setViewMode('list')}
        >
          <Users
            size={20}
            color={viewMode === 'list' ? '#FFFFFF' : '#007AFF'}
          />
          <Text
            style={[
              styles.toggleText,
              viewMode === 'list' && styles.activeToggleText,
            ]}
          >
            List View
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === 'map' && styles.activeToggle,
          ]}
          onPress={() => setViewMode('map')}
        >
          <Map size={20} color={viewMode === 'map' ? '#FFFFFF' : '#007AFF'} />
          <Text
            style={[
              styles.toggleText,
              viewMode === 'map' && styles.activeToggleText,
            ]}
          >
            Map View
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {viewMode === 'map' ? renderMapView() : renderListView()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
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
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 32, fontWeight: '700', color: '#212529' },
  subtitle: { fontSize: 16, color: '#6C757D', lineHeight: 22 },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    marginLeft: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  activeToggle: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  toggleText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  activeToggleText: { color: '#FFFFFF' },
  content: { flex: 1 },
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
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  mapPlaceholderText: { fontSize: 18, color: '#888' },
});
