import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Platform, RefreshControl, Dimensions, ScrollView, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import WebView from 'react-native-webview';
import { colors, shadows, radius } from '@/constants/theme';
import { createClient } from '@supabase/supabase-js';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
const supabase = createClient(
  'https://tscvzrxnxadnvgnsdrqx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzY3Z6cnhueGFkbnZnbnNkcnF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3NDcxMjgsImV4cCI6MjA2MDMyMzEyOH0.cvE6KoZXbSnigKUpbFzFwLtN-O6H4SxIyu5bn9rU1lY'
);

// Real incidents are now fetched from Supabase database

type Incident = {
  id: string;
  type: string;
  description: string;
  status: string;
  created_at: string;
  latitude: number;
  longitude: number;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  video_urls?: string[];
  distance?: number;
};

const REFRESH_INTERVAL = 30000; // 30 seconds
const NEARBY_RADIUS = 5000; // 5km

export default function IncidentsScreen() {
  const { colors, shadows } = useTheme();
  const styles = getStyles(colors, shadows);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const refreshInterval = useRef<NodeJS.Timeout>();
  const mapRef = useRef<WebView>(null);
  const { newIncident } = useLocalSearchParams();

  useEffect(() => {
    checkLocationPermission();
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    if (newIncident) {
      try {
        const incident = JSON.parse(newIncident as string);
        setIncidents(prev => [incident, ...prev]);
      } catch (error) {
        console.error('Error parsing new incident:', error);
      }
    }
  }, [newIncident]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    // Convert coordinates to radians
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is required to show nearby incidents');
        setIsLoading(false);
        return;
      }

      // Get high accuracy location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 0,
        distanceInterval: 0
      });
      
      console.log('Got user location:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy
      });
      
      setLocation(location);
      await fetchIncidents(location);

      refreshInterval.current = setInterval(async () => {
        try {
          const newLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 0,
            distanceInterval: 0
          });
          setLocation(newLocation);
          await fetchIncidents(newLocation);
          setIsConnected(true);
        } catch (error) {
          console.error('Refresh error:', error);
          setIsConnected(false);
        }
      }, REFRESH_INTERVAL);
    } catch (error) {
      console.error('Setup error:', error);
      setError('Failed to get your location. Please check your settings and try again.');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchIncidents = async (userLocation: Location.LocationObject) => {
    try {  
      console.log('Fetching real incidents from Supabase...');
      
      // Fetch real incidents from Supabase database
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50); // Limit to 50 most recent incidents

      if (error) {
        console.error('Supabase error:', error);
        setIsConnected(false);
        setError('Failed to fetch incidents from database. Please try again.');
        return;
      }

      if (!data || data.length === 0) {
        console.log('No incidents found in database');
        setIncidents([]);
        setIsConnected(true);
        setError(null);
        return;
      }

      console.log(`Found ${data.length} incidents in database`);

      // Calculate distances for each incident
      const incidentsWithDistance = data.map(incident => {
        try {
          // Get coordinates directly from the incident
          const latitude = parseFloat(incident.latitude);
          const longitude = parseFloat(incident.longitude);

          if (isNaN(latitude) || isNaN(longitude)) {
            console.warn('Invalid coordinates:', incident);
            return { ...incident, distance: 0 };
          }

          // Calculate distance
          const distance = calculateDistance(
            userLocation.coords.latitude,
            userLocation.coords.longitude,
            latitude,
            longitude
          );

          return {
            ...incident,
            latitude,
            longitude,
            distance
          };
        } catch (error) {
          console.error('Error processing incident:', error);
          return { ...incident, distance: 0 };
        }
      });

      // Sort incidents: latest first, then by distance (nearby)
      const sortedIncidents = incidentsWithDistance.sort((a, b) => {
        // First, get the most recent incident (latest)
        const latestIncident = incidentsWithDistance.reduce((latest, current) => {
          return new Date(current.created_at) > new Date(latest.created_at) ? current : latest;
        });
        
        // If this is the latest incident, put it first
        if (a.id === latestIncident.id) return -1;
        if (b.id === latestIncident.id) return 1;
        
        // For all other incidents, sort by distance (nearby first)
        return (a.distance || 0) - (b.distance || 0);
      });
      
      setIncidents(sortedIncidents);
      setIsConnected(true);
      setError(null);

      if (showMap && mapRef.current) {
        const mapScript = `
          updateMarkers(${JSON.stringify(sortedIncidents)});
          true;
        `;
        mapRef.current.injectJavaScript(mapScript);
      }
    } catch (error) {
      console.error('Error fetching incidents:', error);
      setIsConnected(false);
      setError('Failed to fetch nearby incidents. Please check your connection and try again.');
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000 / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1609.34).toFixed(1)}mi`;
  };

  const renderIncident = ({ item }: { item: Incident }) => (
    <View style={styles.incidentCard}>
      <View style={styles.incidentHeader}>
        <MaterialIcons name="error-outline" color={colors.accent} size={24} />
        <Text style={styles.incidentType}>{item.type}</Text>
      </View>
      <Text style={styles.incidentDescription}>{item.description}</Text>
      
      {/* Show reporter info if available */}
      {item.user_name && (
        <View style={styles.reporterInfo}>
          <MaterialIcons name="person" size={16} color={colors.text.muted} />
          <Text style={styles.reporterText}>Reported by {item.user_name}</Text>
        </View>
      )}
      
      <View style={styles.incidentFooter}>
        <View style={styles.locationInfo}>
          <MaterialIcons name="location-on" size={16} color={colors.text.muted} />
          <Text style={styles.distanceText}>
            {formatDistance(item.distance || 0)} away
          </Text>
        </View>
        <View style={styles.timeInfo}>
          <MaterialIcons name="access-time" size={16} color={colors.text.muted} />
          <Text style={styles.timeAgo}>{formatTimeAgo(item.created_at)}</Text>
        </View>
      </View>
    </View>
  );

  const onRefresh = async () => {
    setIsLoading(true);
    if (location) {
      await fetchIncidents(location);
    }
    setIsLoading(false);
  };

  const mapHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; background: ${colors.primary}; }
          #map { width: 100vw; height: 100vh; background: ${colors.primary}; }
          .leaflet-popup-content-wrapper {
            background: ${colors.secondary};
            color: ${colors.text.primary};
          }
          .leaflet-popup-tip {
            background: ${colors.secondary};
          }
          .area-indicator {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${colors.secondary};
            color: ${colors.text.primary};
            padding: 8px 16px;
            border-radius: 20px;
            font-family: 'Inter-Medium';
            font-size: 14px;
            z-index: 1000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
        </style>
      </head>
      <body>
        <div class="area-indicator">Allowed to view your nearby area and limited limmited radius</div>
        <div id="map"></div>
        <script>
          const map = L.map('map', {
            minZoom: 12,
            maxZoom: 16,
            zoomControl: true,
            maxBounds: [
              [${location?.coords.latitude - 0.1}, ${location?.coords.longitude - 0.1}],
              [${location?.coords.latitude + 0.1}, ${location?.coords.longitude + 0.1}]
            ],
            maxBoundsViscosity: 1.0
          }).setView([${location?.coords.latitude || 0}, ${location?.coords.longitude || 0}], 13);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);

          const circle = L.circle([${location?.coords.latitude || 0}, ${location?.coords.longitude || 0}], {
            color: '${colors.accent}',
            fillColor: '${colors.accent}',
            fillOpacity: 0.1,
            radius: 5000 // 5km in meters
          }).addTo(map);

          // Add a marker for user's location
          const userMarker = L.marker([${location?.coords.latitude || 0}, ${location?.coords.longitude || 0}], {
            icon: L.divIcon({
              className: 'user-location-marker',
              html: '<div style="background-color: ${colors.accent}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>'
            })
          }).addTo(map);

          let markers = [];

          function updateMarkers(incidents) {
            markers.forEach(marker => marker.remove());
            markers = [];

            incidents.forEach(incident => {
              const marker = L.marker([incident.latitude, incident.longitude])
                .bindPopup(
                  '<strong style="color: ${colors.text.primary}">' + incident.type + '</strong><br>' +
                  '<div style="color: ${colors.text.secondary}">' + incident.description + '</div><br>' +
                  '<small style="color: ${colors.text.muted}">' + new Date(incident.created_at).toLocaleString() + '</small>'
                )
                .addTo(map);
              markers.push(marker);
            });
          }

          updateMarkers(${JSON.stringify(incidents)});
        </script>
      </body>
    </html>
  `;

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Nearby Incidents</Text>
        </View>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={80} color={colors.status.error} />
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={checkLocationPermission}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isConnected && (
        <View style={styles.connectionStatus}>
          <MaterialIcons name="wifi-off" size={16} color={colors.status.error} />
          <Text style={styles.connectionStatusText}>
            Connection lost. Retrying...
          </Text>
        </View>
      )}
      
      <View style={styles.headerContainer}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Nearby Incidents</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.viewToggle} 
            onPress={() => setShowMap(!showMap)}>
            {showMap ? (
              <MaterialIcons name="view-list" size={20} color={colors.text.primary} />
            ) : (
              <MaterialIcons name="map" size={20} color={colors.text.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.reportButton} 
            onPress={() => router.push('/report-incident')}>
            <Text style={styles.reportButtonText}>Report</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showMap ? (
        <View style={styles.mapContainer}>
          <WebView
            ref={mapRef}
            source={{ html: mapHTML }}
            style={styles.map}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn('WebView error: ', nativeEvent);
            }}
          />
        </View>
      ) : (
        <FlatList
          data={incidents}
          renderItem={renderIncident}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="error-outline" size={80} color={colors.text.muted} />
              <Text style={styles.emptyStateText}>
                No incidents reported nearby
              </Text>
              <Text style={styles.emptyStateSubtext}>
                You'll be notified when activity is reported in your area
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const getStyles = (colors: any, shadows: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  titleContainer: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    fontFamily: 'Inter-Bold',
  },
  viewToggle: {
    backgroundColor: colors.secondary,
    padding: 10,
    borderRadius: radius.round,
    ...shadows.sm,
  },
  reportButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.round,
    ...shadows.sm,
  },
  reportButtonText: {
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 8,
    paddingHorizontal: 20,
    gap: 8,
  },
  connectionStatusText: {
    color: colors.status.error,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  map: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 120,
  },
  listContainer: {
    padding: 20,
    paddingBottom: 100, // Extra padding at the bottom of the list
  },
  incidentCard: {
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 15,
    ...shadows.sm,
  },
  incidentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  incidentType: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
    fontFamily: 'Inter-SemiBold',
  },
  incidentDescription: {
    color: colors.text.secondary,
    fontSize: 16,
    marginBottom: 10,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
  },
  reporterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  reporterText: {
    color: colors.text.muted,
    fontSize: 14,
    marginLeft: 5,
    fontFamily: 'Inter-Regular',
    fontStyle: 'italic',
  },
  incidentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    color: colors.text.muted,
    marginLeft: 5,
    fontFamily: 'Inter-Regular',
  },
  timeAgo: {
    color: colors.text.muted,
    marginLeft: 5,
    fontFamily: 'Inter-Regular',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    fontFamily: 'Inter-Bold',
  },
  errorText: {
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 30,
    fontFamily: 'Inter-Regular',
  },
  retryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: radius.round,
    ...shadows.sm,
  },
  retryButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    color: colors.text.muted,
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    fontFamily: 'Inter-SemiBold',
  },
  emptyStateSubtext: {
    color: colors.text.muted,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
    fontFamily: 'Inter-Regular',
  },
});