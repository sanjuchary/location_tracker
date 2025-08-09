import * as Location from 'expo-location';
import { Platform } from 'react-native';

export class LocationTracking {
  private static watchSubscription: Location.LocationSubscription | null = null;
  private static callbacks: ((location: Location.LocationObject) => void)[] = [];
  private static isTracking = false;

  static async startTracking(callback: (location: Location.LocationObject) => void): Promise<void> {
    try {
      // Validate callback
      if (typeof callback !== 'function') {
        throw new Error('Invalid callback function provided');
      }

      // Add callback to list
      this.callbacks.push(callback);

      // If already tracking, don't start again
      if (this.isTracking && this.watchSubscription) {
        return;
      }

      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        throw new Error('Location services are not enabled');
      }

      // Request permission with better error handling
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      this.isTracking = true;

      // For web platform, use a simulated tracking approach
      if (Platform.OS === 'web') {
        this.startWebTracking();
        return;
      }

      // Start watching position for native platforms with better error handling
      try {
        this.watchSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (location) => {
            // Notify all callbacks
            this.callbacks.forEach(cb => {
              try {
                if (location && location.coords && 
                    typeof location.coords.latitude === 'number' && 
                    typeof location.coords.longitude === 'number' && 
                    !isNaN(location.coords.latitude) && 
                    !isNaN(location.coords.longitude)) {
                  cb(location);
                }
              } catch (error) {
                console.error('Error in location callback:', error);
              }
            });
          }
        );
      } catch (watchError) {
        console.error('Error starting location watch:', watchError);
        // Fallback to getting current position
        try {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (currentLocation && currentLocation.coords && 
              typeof currentLocation.coords.latitude === 'number' && 
              typeof currentLocation.coords.longitude === 'number' && 
              !isNaN(currentLocation.coords.latitude) && 
              !isNaN(currentLocation.coords.longitude)) {
            this.callbacks.forEach(cb => {
              try {
                cb(currentLocation);
              } catch (error) {
                console.error('Error in location callback:', error);
              }
            });
          }
        } catch (currentError) {
          console.error('Error getting current position:', currentError);
          throw currentError;
        }
      }
    } catch (error) {
      console.error('Error starting location tracking:', error);
      this.isTracking = false;
      throw error;
    }
  }

  private static startWebTracking(): void {
    // For web, get initial position and simulate updates
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: Location.LocationObject = {
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude,
            accuracy: position.coords.accuracy,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          },
          timestamp: position.timestamp,
        };

        // Initial callback
        this.callbacks.forEach(cb => cb(location));

        // Simulate movement for demo purposes
        const interval = setInterval(() => {
          if (!this.isTracking) {
            clearInterval(interval);
            return;
          }

          const updatedLocation: Location.LocationObject = {
            ...location,
            coords: {
              ...location.coords,
              latitude: location.coords.latitude + (Math.random() - 0.5) * 0.0001,
              longitude: location.coords.longitude + (Math.random() - 0.5) * 0.0001,
            },
            timestamp: Date.now(),
          };

          this.callbacks.forEach(cb => cb(updatedLocation));
        }, 3000);
      },
      (error) => {
        console.error('Web geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }

  static stopTracking(): void {
    try {
      this.isTracking = false;
      
      if (this.watchSubscription) {
        this.watchSubscription.remove();
        this.watchSubscription = null;
      }
      
      this.callbacks = [];
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }

  static async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        console.warn('Location services are not enabled');
        return null;
      }

      // Check permission
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission not granted');
        return null;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Validate location data
      if (location && location.coords && 
          typeof location.coords.latitude === 'number' && 
          typeof location.coords.longitude === 'number' && 
          !isNaN(location.coords.latitude) && 
          !isNaN(location.coords.longitude)) {
        return location;
      }

      console.warn('Invalid location data received');
      return null;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  static async getLocationAddress(latitude: number, longitude: number): Promise<string> {
    try {
      // Validate coordinates
      if (typeof latitude !== 'number' || typeof longitude !== 'number' || 
          isNaN(latitude) || isNaN(longitude)) {
        console.warn('Invalid coordinates provided for address lookup');
        return `${latitude?.toFixed(4) || '0'}, ${longitude?.toFixed(4) || '0'}`;
      }

      // For web platform, return coordinates as fallback
      if (Platform.OS === 'web') {
        return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }

      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (addresses.length > 0) {
        const address = addresses[0];
        const parts = [
          address.streetNumber,
          address.street,
          address.city,
          address.region,
        ].filter(Boolean);
        
        return parts.join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }

      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    } catch (error) {
      console.error('Error getting address:', error);
      return `${latitude?.toFixed(4) || '0'}, ${longitude?.toFixed(4) || '0'}`;
    }
  }

  static getDistanceBetween(
    lat1: number, 
    lon1: number, 
    lat2: number, 
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}