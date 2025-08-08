import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MapPin, Clock, Navigation, Package, User } from 'lucide-react-native';
import * as Location from 'expo-location';

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

interface UserLocationCardProps {
  user: TrackedUser;
  onPress: () => void;
}

export function UserLocationCard({ user, onPress }: UserLocationCardProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatCoordinate = (coord: number) => {
    return coord.toFixed(6);
  };

  const getAccuracyColor = (accuracy: number | null) => {
    if (!accuracy) return '#6C757D';
    if (accuracy <= 5) return '#28A745'; // Excellent
    if (accuracy <= 15) return '#FFC107'; // Good
    return '#DC3545'; // Poor
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? '#28A745' : '#6C757D';
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={[styles.userIcon, { backgroundColor: getStatusColor(user.status) }]}>
            <User size={20} color="#FFFFFF" />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user.name}</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(user.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(user.status) }]}>
                {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.timeContainer}>
          <Clock size={16} color="#6C757D" />
          <Text style={styles.timeText}>{formatTime(user.lastUpdated)}</Text>
        </View>
      </View>

      {user.orderInfo && (
        <View style={styles.orderInfo}>
          <View style={styles.orderHeader}>
            <Package size={16} color="#007AFF" />
            <Text style={styles.orderTitle}>Order Details</Text>
          </View>
          <View style={styles.orderDetails}>
            <Text style={styles.orderId}>{user.orderInfo.orderId}</Text>
            <Text style={styles.orderItems}>{user.orderInfo.items}</Text>
            <Text style={styles.estimatedDelivery}>
              ETA: {user.orderInfo.estimatedDelivery}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.locationSection}>
        <View style={styles.locationHeader}>
          <MapPin size={16} color="#007AFF" />
          <Text style={styles.locationTitle}>Location</Text>
        </View>
        
        <View style={styles.coordinates}>
          <View style={styles.coordRow}>
            <Text style={styles.coordLabel}>Latitude:</Text>
            <Text style={styles.coordValue}>
              {formatCoordinate(user.location.coords.latitude)}
            </Text>
          </View>
          
          <View style={styles.coordRow}>
            <Text style={styles.coordLabel}>Longitude:</Text>
            <Text style={styles.coordValue}>
              {formatCoordinate(user.location.coords.longitude)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.accuracy}>
          <Navigation size={16} color={getAccuracyColor(user.location.coords.accuracy)} />
          <Text style={[
            styles.accuracyText,
            { color: getAccuracyColor(user.location.coords.accuracy) }
          ]}>
            ±{user.location.coords.accuracy?.toFixed(0) || '?'}m accuracy
          </Text>
        </View>
        
        <Text style={styles.viewOnMap}>View on Map →</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F1F3F4',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userIcon: {
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 6,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#6C757D',
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  orderInfo: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginLeft: 8,
  },
  orderDetails: {
    gap: 6,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  orderItems: {
    fontSize: 14,
    color: '#6C757D',
  },
  estimatedDelivery: {
    fontSize: 14,
    color: '#28A745',
    fontWeight: '500',
  },
  locationSection: {
    marginBottom: 16,
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
  coordinates: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  coordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  coordLabel: {
    fontSize: 14,
    color: '#6C757D',
    fontWeight: '500',
  },
  coordValue: {
    fontSize: 14,
    color: '#212529',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
  },
  accuracy: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accuracyText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  viewOnMap: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});