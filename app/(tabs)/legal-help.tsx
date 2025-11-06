import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Linking,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { radius } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';

type Attorney = {
  id: string;
  name: string;
  cases: number;
  detailedLocation: string;
  featured: boolean;
  image: string;
  languages: string[];
  lat: number;
  lng: number;
  location: string;
  phone?: string;
  rating: number;
  specialization: string;
  website?: string;
  email?: string;
};

type LegalHelpState = {
  searchQuery: string;
  showFilters: boolean;
  filters: {
    proBono: boolean;
    slidingScale: boolean;
    distance: boolean;
    rating: boolean;
  };
  refreshing: boolean;
  attorneys: Attorney[];
  originalAttorneys: Attorney[]; // Keep original data separate
  userLocation: Location.LocationObject | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: LegalHelpState = {
  searchQuery: '',
  showFilters: false,
  filters: {
    proBono: false,
    slidingScale: false,
    distance: false,
    rating: false,
  },
  refreshing: false,
  attorneys: [],
  originalAttorneys: [],
  userLocation: null,
  isLoading: true,
  error: null,
};

export default function LegalHelpScreen() {
  const { colors, shadows } = useTheme();
  const styles = getStyles(colors, shadows);
  const [state, setState] = useState<LegalHelpState>(() => ({
    ...initialState,
    attorneys: [],
    originalAttorneys: []
  }));

  const updateState = (updates: Partial<LegalHelpState>) => {
    setState(prev => ({
      ...prev,
      ...updates
    }));
  };

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const requestLocationPermission = async () => {
    try {
      updateState({ isLoading: true, error: null });
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        updateState({ userLocation: location });
        await fetchAttorneys(location);
      } else {
        updateState({ 
          error: 'Location access is required to find attorneys near you. Please enable location services in your device settings.',
          isLoading: false 
        });
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      updateState({ 
        error: 'Failed to get location. Please check your device settings and try again.',
        isLoading: false 
      });
    }
  };

  const fetchAttorneys = async (location: Location.LocationObject) => {
    try {
      updateState({ isLoading: true, error: null, attorneys: [], originalAttorneys: [] });
      console.log('🔍 Fetching attorneys with location:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      const url = `https://www.wedesist.com/api/attorneys?lat=${location.coords.latitude}&lng=${location.coords.longitude}&radius=50`;
      console.log('🌐 Request URL:', url);

      const response = await fetch(url);
      console.log('📥 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('📦 Parsed response data:', data);
      
      if (!data || !Array.isArray(data.attorneys)) {
        console.error('❌ Invalid data format:', data);
        throw new Error('Invalid response format from server');
      }
      
      console.log('✅ Successfully fetched attorneys:', data.attorneys.length);
      updateState({
        attorneys: data.attorneys,
        originalAttorneys: data.attorneys
      });
    } catch (error) {
      console.error('❌ Error in fetchAttorneys:', error);
      updateState({
        attorneys: [],
        originalAttorneys: [],
        error: 'Failed to fetch attorneys'
      });
      Alert.alert(
        'Error',
        'Unable to fetch attorneys. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      updateState({ isLoading: false });
    }
  };

  const getFilteredAttorneys = () => {
    const originalAttorneys = state.originalAttorneys || [];

    if (originalAttorneys.length === 0) {
      return [];
    }

    let filtered = [...originalAttorneys];

    // Apply search filter
    if (state.searchQuery.trim()) {
      filtered = filtered.filter(
        attorney =>
          attorney.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
          attorney.specialization.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
          attorney.languages.some(language =>
            language.toLowerCase().includes(state.searchQuery.toLowerCase())
          )
      );
    }

    // Apply other filters
    if (state.filters.proBono) {
      filtered = filtered.filter(attorney => attorney.featured);
    }

    if (state.filters.slidingScale) {
      filtered = filtered.filter(attorney => attorney.featured);
    }

    // Apply sorting
    if (state.filters.rating) {
      filtered = filtered.sort((a, b) => b.rating - a.rating);
    }

    if (state.filters.distance) {
      filtered = filtered.sort((a, b) =>
        parseFloat(a.location) < parseFloat(b.location) ? -1 : 1
      );
    }

    return filtered;
  };

  // Update attorneys whenever search or filters change
  useEffect(() => {
    if (state.originalAttorneys.length > 0) {
      const filteredAttorneys = getFilteredAttorneys();
      updateState({ attorneys: filteredAttorneys });
    }
  }, [state.searchQuery, state.filters, state.originalAttorneys]);

  const onRefresh = async () => {
    updateState({ refreshing: true });
    if (state.userLocation) {
      await fetchAttorneys(state.userLocation);
    }
    updateState({ refreshing: false });
  };

  const renderContent = () => {
    const attorneys = state.attorneys || [];

    if (state.isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading attorneys...</Text>
        </View>
      );
    }

    if (state.error) {
      return (
        <View style={styles.errorContainer}>
          <MaterialIcons name="location-off" size={48} color={colors.text.muted} />
          <Text style={styles.errorText}>{state.error}</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.retryButton, styles.settingsButton]}
              onPress={openSettings}>
              <Text style={styles.retryButtonText}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={requestLocationPermission}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (!state.userLocation) {
      return (
        <View style={styles.errorContainer}>
          <MaterialIcons name="location-off" size={48} color={colors.text.muted} />
          <Text style={styles.errorText}>Location access is required to find attorneys near you</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={requestLocationPermission}>
            <Text style={styles.retryButtonText}>Allow Location Access</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (attorneys.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No attorneys found in your area</Text>
        </View>
      );
    }

    return attorneys?.length && attorneys.map(attorney => (
      <View key={attorney.id} style={styles.attorneyCard}>
        <View style={styles.cardHeader}>
          <View style={styles.headerInfo}>
            <Text style={styles.attorneyName}>{attorney.name}</Text>
            <View style={styles.ratingContainer}>
              {Array(5).fill(0).map((_, i) => (
                <MaterialIcons
                  key={i}
                  name="star"
                  size={16}
                  color={i < Math.round(attorney.rating) ? colors.accent : colors.text.muted}
                />
              ))}
              <Text style={styles.ratingText}>{attorney.rating.toFixed(1)}</Text>
            </View>
            <View style={styles.locationContainer}>
              <MaterialIcons name="location-on" size={14} color={colors.text.muted} />
              <Text style={styles.distanceText}>{attorney.location}</Text>
            </View>
          </View>
        </View>

        {attorney.detailedLocation !== "Address not available" && (
          <View style={styles.addressContainer}>
            <MaterialIcons name="business" size={14} color={colors.text.muted} />
            <Text style={styles.addressText}>{attorney.detailedLocation}</Text>
          </View>
        )}

        {attorney.languages?.length > 0 && (
          <View style={styles.languagesContainer}>
            <MaterialIcons name="language" size={16} color={colors.text.muted} />
            <Text style={styles.languagesText}>
              {attorney.languages.join(', ')}
            </Text>
          </View>
        )}

        <View style={styles.contactContainer}>
          {attorney.phone && (
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => Linking.openURL(`tel:${attorney.phone}`)}>
              <Text style={styles.contactButtonText}>Call</Text>
            </TouchableOpacity>
          )}
          {attorney.email && (
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => Linking.openURL(`mailto:${attorney.email}`)}>
              <Text style={styles.contactButtonText}>Email</Text>
            </TouchableOpacity>
          )}
          {attorney.website && (
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => attorney.website && Linking.openURL(attorney.website)}>
              <Text style={styles.contactButtonText}>Website</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Legal Help</Text>
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => updateState({ showFilters: !state.showFilters })}>
          <MaterialIcons
            name="filter-list"
            size={24}
            color={colors.text.primary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color={colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search attorneys..."
          placeholderTextColor={colors.text.muted}
          value={state.searchQuery}
          onChangeText={(text) => updateState({ searchQuery: text })}
        />
      </View>

      {state.showFilters && (
        <View style={styles.filtersContainer}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              state.filters.proBono && styles.filterChipActive,
            ]}
            onPress={() =>
              updateState({
                filters: { ...state.filters, proBono: !state.filters.proBono },
              })
            }>
            <MaterialIcons
              name="check-circle"
              size={16}
              color={state.filters.proBono ? colors.status.success : colors.text.muted}
            />
            <Text
              style={[
                styles.filterChipText,
                state.filters.proBono && styles.filterChipTextActive,
              ]}>
              Pro Bono
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              state.filters.slidingScale && styles.filterChipActive,
            ]}
            onPress={() =>
              updateState({
                filters: {
                  ...state.filters,
                  slidingScale: !state.filters.slidingScale,
                },
              })
            }>
            <MaterialIcons
              name="attach-money"
              size={16}
              color={state.filters.slidingScale ? colors.accent : colors.text.muted}
            />
            <Text
              style={[
                styles.filterChipText,
                state.filters.slidingScale && styles.filterChipTextActive,
              ]}>
              Sliding Scale
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              state.filters.distance && styles.filterChipActive,
            ]}
            onPress={() =>
              updateState({
                filters: { ...state.filters, distance: !state.filters.distance },
              })
            }>
            <MaterialIcons
              name="location-on"
              size={16}
              color={state.filters.distance ? colors.accent : colors.text.muted}
            />
            <Text
              style={[
                styles.filterChipText,
                state.filters.distance && styles.filterChipTextActive,
              ]}>
              Distance
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              state.filters.rating && styles.filterChipActive,
            ]}
            onPress={() =>
              updateState({
                filters: { ...state.filters, rating: !state.filters.rating },
              })
            }>
            <MaterialIcons
              name="star"
              size={16}
              color={state.filters.rating ? colors.accent : colors.text.muted}
            />
            <Text
              style={[
                styles.filterChipText,
                state.filters.rating && styles.filterChipTextActive,
              ]}>
              Rating
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }>
        {renderContent()}
        
        {state.attorneys.length > 0 && (  
          <TouchableOpacity onPress={() => Linking.openURL('mailto:chrisrashadmitchell@gmail.com')}>
            <Text style={styles.addAttorneyText}>Become the top attorney in the list? <Text style={styles.addAttorneyHighlightedText} onPress={() => Linking.openURL('mailto:admin@wedesit.com')}>Contact Admin.</Text></Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any, shadows: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    fontFamily: 'Inter-Bold',
  },
  filterButton: {
    backgroundColor: colors.secondary,
    padding: 10,
    borderRadius: radius.round,
    ...shadows.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    marginHorizontal: 20,
    paddingHorizontal: 15,
    borderRadius: radius.lg,
    marginBottom: 15,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    paddingVertical: 12,
    marginLeft: 10,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChip: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.text.muted,
  },
  filterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterChipText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  filterChipTextActive: {
    color: colors.text.primary,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 20, // Add padding to account for tab bar
  },
  attorneyCard: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  headerInfo: {
    flex: 1,
  },
  attorneyName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 14,
    color: colors.text.muted,
    marginLeft: 4,
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.text.primary,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: colors.text.muted,
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  statText: {
    fontSize: 14,
    color: colors.text.primary,
    marginLeft: 4,
  },
  languagesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  languagesText: {
    fontSize: 14,
    color: colors.text.muted,
    marginLeft: 4,
  },
  contactContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  contactButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  contactButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  addAttorneyText: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  addAttorneyHighlightedText: {
    color: colors.accent,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: colors.text.primary,
    marginTop: 10,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  settingsButton: {
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});