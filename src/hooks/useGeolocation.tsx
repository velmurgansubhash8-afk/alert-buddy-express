import { useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface UseGeolocationReturn {
  location: LocationData | null;
  loading: boolean;
  error: string | null;
  getCurrentLocation: () => Promise<LocationData | null>;
  generateMapsLink: (lat: number, lon: number) => string;
}

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    setLoading(true);
    setError(null);

    try {
      // Check if running on native platform
      if (Capacitor.isNativePlatform()) {
        // Request permissions for native
        const permissions = await Geolocation.checkPermissions();
        
        if (permissions.location !== 'granted') {
          const requestResult = await Geolocation.requestPermissions();
          if (requestResult.location !== 'granted') {
            throw new Error('Location permission denied');
          }
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });

        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        setLocation(locationData);
        return locationData;
      } else {
        // Fallback to web API
        return new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            const err = 'Geolocation is not supported by this browser';
            setError(err);
            reject(new Error(err));
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              const locationData: LocationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
              };
              setLocation(locationData);
              setLoading(false);
              resolve(locationData);
            },
            (err) => {
              const errorMessage = err.message || 'Failed to get location';
              setError(errorMessage);
              setLoading(false);
              reject(new Error(errorMessage));
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            }
          );
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      setLoading(false);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateMapsLink = useCallback((lat: number, lon: number): string => {
    // Using Google Maps URL which works universally
    return `https://www.google.com/maps?q=${lat},${lon}`;
  }, []);

  return {
    location,
    loading,
    error,
    getCurrentLocation,
    generateMapsLink,
  };
}
