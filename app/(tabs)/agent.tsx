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
import { UserLocationCard } from '@/components/UserLocationCard';
import { MapComponent } from '@/components/MapComponent';
import { Users, Map, RefreshCw } from 'lucide-react-native';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { View as RNView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';

interface TrackedUser {
  id: string;
  name: string;
  location: Location.LocationObject;
  lastUpdated: Date;
  status: 'active' | 'inactive';
  orderInfo?: {
    orderId: string;
    items: string;
    estimatedDelivery: string;
  };
}

export default function AgentScreen() {
  const [selectedUser, setSelectedUser] = useState<TrackedUser | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [userLocations, setUserLocations] = useState<{
    [userId: string]: { latitude: number; longitude: number };
  }>({});
  const [socket, setSocket] = useState<any>(null);
  const [agentLocation, setAgentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const router = useRouter();
  const MAPBOX_API_KEY =
    'pk.eyJ1Ijoic2FuanUxNSIsImEiOiJjbWUxMGR4bWMwYmE3Mmpwcmo1cmE5eW40In0._JC7w64EKxzPNMCaIrUgqA';
  const [routeCoords, setRouteCoords] = useState([]);

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

      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'This app needs location permission to track delivery locations. Please grant permission in settings.',
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
        
        socketInstance.on('userLocation', (data: any) => {
          try {
            console.log('Received userLocation:', data);
            if (data && data.userId && typeof data.latitude === 'number' && typeof data.longitude === 'number' && 
                !isNaN(data.latitude) && !isNaN(data.longitude)) {
              setUserLocations((prev) => ({
                ...prev,
                [data.userId]: { latitude: data.latitude, longitude: data.longitude },
              }));
            }
          } catch (error) {
            console.error('Error processing user location:', error);
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

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      // Simulate API call delay
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setIsRefreshing(false);
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

  useEffect(() => {
    if (agentLocation) {
      sendLocation(agentLocation.latitude, agentLocation.longitude);
    }
  }, [agentLocation]);

  // Fetch directions whenever agentLocation or any user location changes
  useEffect(() => {
    if (agentLocation && selectedUserId && userLocations[selectedUserId]) {
      const fetchRoute = async () => {
        try {
          const from = `${userLocations[selectedUserId].longitude},${userLocations[selectedUserId].latitude}`;
          const to = `${agentLocation.longitude},${agentLocation.latitude}`;
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from};${to}?geometries=geojson&access_token=${MAPBOX_API_KEY}`;
          
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          
          const data = await res.json();
          if (data.routes && data.routes.length > 0 && data.routes[0].geometry && data.routes[0].geometry.coordinates) {
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
    } else {
      setRouteCoords([]);
    }
  }, [agentLocation, selectedUserId, userLocations]);

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      router.replace('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      Alert.alert('Logout Error', 'Failed to logout. Please try again.');
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
        description="This app needs location permission to show user locations and provide accurate tracking."
        onRetry={requestLocationPermission}
      />
    );
  }

  // List view: show all users currently sharing location via Socket.IO
  const renderListView = () => (
    <FlatList
      data={Object.entries(userLocations)}
      keyExtractor={([userId]) => userId}
      renderItem={({ item: [userId, loc] }) => (
        <TouchableOpacity
          onPress={() => handleTrackUser(userId)}
          style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}
        >
          <Text>User: {userId}</Text>
          <Text>
            Lat: {loc.latitude.toFixed(6)}, Lng: {loc.longitude.toFixed(6)}
          </Text>
          <Text style={{ color: '#007AFF', marginTop: 4 }}>
            {selectedUserId === userId ? 'Tracking' : 'Track'}
          </Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <Text style={{ textAlign: 'center', marginTop: 32, color: '#888' }}>
          No users are currently sharing their location.
        </Text>
      }
    />
  );

  const getMapRegion = () => {
    if (selectedUserId && userLocations[selectedUserId] && agentLocation) {
      // Center between agent and user
      const lat =
        (userLocations[selectedUserId].latitude + agentLocation.latitude) / 2;
      const lng =
        (userLocations[selectedUserId].longitude + agentLocation.longitude) / 2;
      return {
        latitude: lat,
        longitude: lng,
        latitudeDelta:
          Math.abs(
            userLocations[selectedUserId].latitude - agentLocation.latitude
          ) + 0.01,
        longitudeDelta:
          Math.abs(
            userLocations[selectedUserId].longitude - agentLocation.longitude
          ) + 0.01,
      };
    } else if (selectedUserId && userLocations[selectedUserId]) {
      return {
        latitude: userLocations[selectedUserId].latitude,
        longitude: userLocations[selectedUserId].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    } else if (agentLocation) {
      return {
        latitude: agentLocation.latitude,
        longitude: agentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    return {
      latitude: 37.78825,
      longitude: -122.4324,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  };

  // Replace renderMapView with real map
  const renderMapView = () => {
    try {
      const mapRegion = getMapRegion();
      
      // Validate mapRegion before rendering
      if (!mapRegion || 
          typeof mapRegion.latitude !== 'number' || 
          typeof mapRegion.longitude !== 'number' || 
          isNaN(mapRegion.latitude) || 
          isNaN(mapRegion.longitude)) {
        return (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>Loading map...</Text>
          </View>
        );
      }

      return (
        <MapView style={{ flex: 1 }} region={mapRegion}>
          {/* Agent's own location as a blue circle with label */}
          {agentLocation && 
           typeof agentLocation.latitude === 'number' && 
           typeof agentLocation.longitude === 'number' && 
           !isNaN(agentLocation.latitude) && 
           !isNaN(agentLocation.longitude) && (
            <Marker coordinate={agentLocation} title="You: Customer">
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
          {/* User locations as red markers */}
          {Object.entries(userLocations).map(([userId, userLocation]) => {
            if (typeof userLocation.latitude === 'number' && 
                typeof userLocation.longitude === 'number' && 
                !isNaN(userLocation.latitude) && 
                !isNaN(userLocation.longitude)) {
              return (
                <Marker
                  key={userId}
                  coordinate={userLocation}
                  title={`User ${userId}`}
                  pinColor="#FF3B30"
                />
              );
            }
            return null;
          })}
          {/* Route polyline if available */}
          {routeCoords.length > 0 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor="#007AFF"
              strokeWidth={3}
            />
          )}
        </MapView>
      );
    } catch (error) {
      console.error('Error rendering map view:', error);
      return (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>Error loading map</Text>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Agent Dashboard</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={refreshData}>
            <RefreshCw size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton} onPress={handleLogout}>
            <Text style={{ color: '#DC3545', fontWeight: 'bold' }}>Logout</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          {Object.keys(userLocations).length} active delivery •{' '}
          {Object.keys(userLocations).length} total users
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
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#212529',
  },
  subtitle: {
    fontSize: 16,
    color: '#6C757D',
    lineHeight: 22,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
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
  activeToggleText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  selectedUserOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  selectedUserTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  selectedUserOrder: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 12,
  },
  clearSelectionButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  clearSelectionText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
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
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  mapPlaceholderText: {
    fontSize: 18,
    color: '#888',
  },
});
