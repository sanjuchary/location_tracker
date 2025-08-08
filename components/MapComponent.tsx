import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MapPin } from 'lucide-react-native';

interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description: string;
  color: string;
}

interface MapComponentProps {
  latitude: number;
  longitude: number;
  markers?: MapMarker[];
  zoom?: number;
}

export function MapComponent({ latitude, longitude, markers = [], zoom = 15 }: MapComponentProps) {
  // For web platform, we'll show a styled placeholder that looks like a map
  // In a real app, you'd integrate with a web mapping service like Google Maps or Mapbox
  
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webMapContainer}>
        <View style={styles.webMapHeader}>
          <MapPin size={20} color="#007AFF" />
          <Text style={styles.webMapTitle}>Interactive Map</Text>
        </View>
        
        <View style={styles.webMapContent}>
          <Text style={styles.centerCoords}>
            Center: {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </Text>
          
          {markers.length > 0 && (
            <View style={styles.markersContainer}>
              <Text style={styles.markersTitle}>Tracked Locations ({markers.length})</Text>
              {markers.map((marker, index) => (
                <View key={marker.id} style={styles.markerItem}>
                  <View style={[styles.markerDot, { backgroundColor: marker.color }]} />
                  <View style={styles.markerInfo}>
                    <Text style={styles.markerTitle}>{marker.title}</Text>
                    <Text style={styles.markerDescription}>{marker.description}</Text>
                    <Text style={styles.markerCoords}>
                      {marker.latitude.toFixed(6)}, {marker.longitude.toFixed(6)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
        
        <View style={styles.webMapFooter}>
          <Text style={styles.webMapNote}>
            📱 On mobile devices, this would show a native map with real-time tracking
          </Text>
        </View>
      </View>
    );
  }

  // For native platforms, you would use react-native-maps here
  // This is a fallback for the current environment
  return (
    <View style={styles.nativeMapPlaceholder}>
      <MapPin size={48} color="#007AFF" />
      <Text style={styles.nativeMapText}>Native Map View</Text>
      <Text style={styles.nativeMapSubtext}>
        Location: {latitude.toFixed(4)}, {longitude.toFixed(4)}
      </Text>
      {markers.length > 0 && (
        <Text style={styles.nativeMapMarkers}>
          {markers.length} marker{markers.length !== 1 ? 's' : ''} displayed
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  webMapContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  webMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  webMapTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  webMapContent: {
    flex: 1,
    padding: 16,
  },
  centerCoords: {
    fontSize: 14,
    color: '#6C757D',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 20,
    textAlign: 'center',
  },
  markersContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  markersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 16,
  },
  markerItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  markerInfo: {
    flex: 1,
  },
  markerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  markerDescription: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 4,
  },
  markerCoords: {
    fontSize: 12,
    color: '#ADB5BD',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  webMapFooter: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  webMapNote: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  nativeMapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  nativeMapText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
    marginTop: 16,
    marginBottom: 8,
  },
  nativeMapSubtext: {
    fontSize: 14,
    color: '#6C757D',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  nativeMapMarkers: {
    fontSize: 14,
    color: '#28A745',
    marginTop: 8,
    fontWeight: '500',
  },
});