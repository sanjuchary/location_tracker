import * as Location from 'expo-location';
import { Platform } from 'react-native';

export class LocationTracking {
  private static watchSubscription: Location.LocationSubscription | null = null;
  private static callbacks: ((location: Location.LocationObject) => void)[] = [];
  private static isTracking = false;

  static async startTracking(callback: (location: Location.LocationObject) => void): Promise<void> {
    // Add callback to list
    this.callbacks.push(callback);

    // If already tracking, don't start again
    if (this.isTracking && this.watchSubscription) {
      return;
    }

    try {
      // Request permission
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

      // Start watching position for native platforms
      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000, // Update every 3 seconds
          distanceInterval: 5, // Update every 5 meters
        },
        (location) => {
          // Notify all callbacks
          this.callbacks.forEach(cb => cb(location));
        }
      );
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
    this.isTracking = false;
    
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
    
    this.callbacks = [];
  }

  static async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      if (Platform.OS === 'web') {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
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
              });
            },
            reject,
            { enableHighAccuracy: true }
          );
        });
      }

      return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  static async getLocationAddress(latitude: number, longitude: number): Promise<string> {
    try {
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
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
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