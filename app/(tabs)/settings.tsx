import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, Platform, ScrollView, KeyboardAvoidingView, Alert, BackHandler } from 'react-native';
import { BlurView } from 'expo-blur';
import { useState, useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { shadows, radius } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useStealthMode } from '@/components/StealthModeManager';
import * as LocalAuthentication from 'expo-local-authentication';
import { useBiometricLogin } from '@/components/BiometricLoginProvider';


interface Incident {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  // Add other incident fields as needed
}

export default function SettingsScreen() {
  const { colors, shadows, themeMode, setThemeMode } = useTheme();
  const { signOut, userProfile, user, fetchUserProfile } = useAuth();
  const { isActive, activate, deactivate } = useStealthMode();
  const { biometricLoginEnabled, biometricAvailable } = useBiometricLogin();
  const [highQuality, setHighQuality] = useState(true);
  const [enableSound, setEnableSound] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [incidentAlerts, setIncidentAlerts] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyMessage, setEmergencyMessage] = useState(
    'EMERGENCY: I need immediate assistance. My location is attached.'
  );
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isTogglingStealth, setIsTogglingStealth] = useState(false);
  const [isTogglingBiometricLogin, setIsTogglingBiometricLogin] = useState(false);
  const [panicModeEnabled, setPanicModeEnabled] = useState(false);
  const [panicGestureType, setPanicGestureType] = useState<'triple_power' | 'shake' | 'long_press'>('triple_power');
  const [isTogglingPanicMode, setIsTogglingPanicMode] = useState(false);

  const handleStealthToggle = async (value: boolean) => {
    if (isTogglingStealth) return;
    try {
      setIsTogglingStealth(true);
      if (value) {
        await activate('manual');
      } else {
        await deactivate('manual');
      }
    } catch (error) {
      console.error('Error toggling stealth mode:', error);
    } finally {
      setIsTogglingStealth(false);
    }
  };

  useEffect(() => {
    // Configure notification handler
    const configureNotifications = async () => {
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true
        }),
      });
    };

    configureNotifications();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      // Navigation will be handled by AuthProvider
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Note: Real-time incident notifications are now handled via push notifications
  // when incidents are reported, rather than through Supabase real-time subscriptions
  // This provides better reliability and works across different devices/users

  // Helper function to calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const toRad = (value: number) => {
    return value * Math.PI / 180;
  };

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        await checkPermissions();
        await loadEmergencySettings();
        await checkBiometricAvailability();
        await loadBiometricLoginSetting();
        await loadPanicModeSetting();
        // Fetch user profile if user exists but profile is not loaded
        if (user && !userProfile) {
          console.log('Settings: Fetching user profile for user:', user.id);
          await fetchUserProfile(user.id);
        }
      };
      loadData();
    }, [user, userProfile, fetchUserProfile])
  );

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const fullName = (userProfile?.full_name || (user?.user_metadata?.full_name)) as string | undefined;
  const username = (userProfile?.username || (user?.user_metadata?.username)) as string | undefined;
  const email = (userProfile?.email || user?.email) as string | undefined;
  const initials = getInitials(fullName);


  const handleEmergencyContactChange = (text: string) => {
    setEmergencyContact(text);
  };

  const handleEmergencyMessageChange = (text: string) => {
    setEmergencyMessage(text);
  };

  const checkBiometricAvailability = async () => {
    try {
      if (Platform.OS === 'web') {
        return;
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    } catch (error) {
      console.error('Error checking biometric availability:', error);
    }
  };

  const handleBiometricLoginToggle = async (value: boolean) => {
    if (isTogglingBiometricLogin) return;
    
    if (!biometricAvailable) {
      Alert.alert(
        'Biometric Not Available',
        'Biometric authentication is not available on this device. Please set up Face ID or Touch ID in your device settings.'
      );
      return;
    }

    try {
      setIsTogglingBiometricLogin(true);
      
      if (!user?.id) {
        Alert.alert('Error', 'You must be logged in to save settings');
        setIsTogglingBiometricLogin(false);
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({
          biometric_login_enabled: value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving biometric login setting:', error);
        Alert.alert('Error', 'Failed to save biometric login setting');
        setIsTogglingBiometricLogin(false);
        return;
      }

      // Biometric login enabled is managed by BiometricLoginProvider context
    } catch (error) {
      console.error('Error toggling biometric login:', error);
      Alert.alert('Error', 'Failed to update biometric login setting');
    } finally {
      setIsTogglingBiometricLogin(false);
    }
  };

  const loadBiometricLoginSetting = async () => {
    try {
      if (!user?.id) {
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('biometric_login_enabled')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading biometric login setting:', error);
        return;
      }

      // Biometric login enabled is managed by BiometricLoginProvider context
    } catch (error) {
      console.error('Error loading biometric login setting:', error);
    }
  };

  const loadPanicModeSetting = async () => {
    try {
      if (!user?.id) {
        setPanicModeEnabled(false);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('panic_mode_enabled, panic_gesture_type')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading panic mode setting:', error);
        setPanicModeEnabled(false);
        return;
      }

      setPanicModeEnabled(data?.panic_mode_enabled || false);
      if (data?.panic_gesture_type) {
        setPanicGestureType(data.panic_gesture_type as 'triple_power' | 'shake' | 'long_press');
      }
    } catch (error) {
      console.error('Error loading panic mode setting:', error);
    }
  };

  const handlePanicModeToggle = async (value: boolean) => {
    if (isTogglingPanicMode) return;

    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to save settings');
      return;
    }

    try {
      setIsTogglingPanicMode(true);

      const { error } = await supabase
        .from('users')
        .update({
          panic_mode_enabled: value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving panic mode setting:', error);
        Alert.alert('Error', 'Failed to save panic mode setting');
        return;
      }

      setPanicModeEnabled(value);
    } catch (error) {
      console.error('Error toggling panic mode:', error);
      Alert.alert('Error', 'Failed to update panic mode setting');
    } finally {
      setIsTogglingPanicMode(false);
    }
  };

  const checkPermissions = async () => {
    const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
    setLocationEnabled(locationStatus === 'granted');

    if (Platform.OS !== 'web') {
      const { status: notificationStatus } = await Notifications.getPermissionsAsync();
      setNotifications(notificationStatus === 'granted');
    }
  };

  const loadEmergencySettings = async () => {
    try {
      if (!user?.id) {
        // Fallback to AsyncStorage if no user
        const contact = await AsyncStorage.getItem('emergencyContact');
        const message = await AsyncStorage.getItem('emergencyMessage');
        setEmergencyContact(contact || '');
        setEmergencyContactName('');
        setEmergencyMessage(message || 'EMERGENCY: I need immediate assistance. My location is attached.');
        return;
      }

      // Load from Supabase
      const { data, error } = await supabase
        .from('users')
        .select('emergency_contact_name, emergency_contact_phone, emergency_message')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading emergency settings:', error);
        // Fallback to AsyncStorage
        const contact = await AsyncStorage.getItem('emergencyContact');
        const message = await AsyncStorage.getItem('emergencyMessage');
        setEmergencyContact(contact || '');
        setEmergencyContactName('');
        setEmergencyMessage(message || 'EMERGENCY: I need immediate assistance. My location is attached.');
        return;
      }

      // Set both name and phone
      setEmergencyContactName(data?.emergency_contact_name || '');
      setEmergencyContact(data?.emergency_contact_phone || '');
      setEmergencyMessage(data?.emergency_message || 'EMERGENCY: I need immediate assistance. My location is attached.');
    } catch (error) {
      console.error('Error loading emergency settings:', error);
    }
  };

  const saveEmergencySettings = async () => {
    try {
      await AsyncStorage.setItem('emergencyContact', emergencyContact);
      await AsyncStorage.setItem('emergencyMessage', emergencyMessage);
      setIsEditingContact(false);
    } catch (error) {
      console.error('Error saving emergency settings:', error);
    }
  };

  const toggleIncidentAlerts = async (value: boolean) => {
    if (value && Platform.OS !== 'web') {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Notification permissions are required for incident alerts');
        return;
      }
    }
    setIncidentAlerts(value);
  };

  const styles = getStyles(colors, shadows);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Settings</Text>

        <TouchableOpacity 
              style={[styles.actionButton, styles.actionDanger]} 
              onPress={handleLogout}
              activeOpacity={0.7}>
              <MaterialIcons name="logout" size={18} color={colors.status.error} />
              <Text style={[styles.actionButtonText, styles.actionDangerText]}>Logout</Text>
            </TouchableOpacity>
        
        {/* Profile Header Card */}
        <TouchableOpacity 
          style={styles.profileCard}
          onPress={() => router.push('/profile')}
          activeOpacity={0.7}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{fullName || 'Loading...'}</Text>
              <Text style={styles.profileEmail}>{email || 'loading@email'}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.securitySection}>
          <View style={styles.securityHeader}>
            <MaterialIcons name="security" size={20} color={colors.accent} />
            <Text style={styles.securitySectionTitle}>Security Features</Text>
          </View>
          <Text style={styles.securitySubtitle}>Advanced protection features</Text>

          {/* <BlurView intensity={80} style={styles.securityBlurWrapper}> */}
            <View style={styles.stealthModeContainer}>
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <MaterialIcons name="visibility" size={24} color={colors.accent} />
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingText}>Stealth Mode</Text>
                    <Text style={styles.settingSubtext}>Transform app into calculator</Text>
                  </View>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={handleStealthToggle}
                  disabled={isTogglingStealth}
                  trackColor={{ false: colors.text.muted, true: colors.accent }}
                  thumbColor={isActive ? colors.text.primary : colors.text.secondary}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <MaterialIcons name="lock" size={24} color={colors.accent} />
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingText}>Biometric Login</Text>
                    <Text style={styles.settingSubtext}>
                      {biometricAvailable 
                        ? 'Lock app with biometric authentication on launch'
                        : 'Biometric authentication not available'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={biometricLoginEnabled}
                  onValueChange={handleBiometricLoginToggle}
                  disabled={!biometricAvailable || isTogglingBiometricLogin}
                  trackColor={{ false: colors.text.muted, true: colors.accent }}
                  thumbColor={biometricLoginEnabled ? colors.text.primary : colors.text.secondary}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <MaterialIcons name="vpn-key" size={24} color={colors.accent} />
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingText}>Panic Mode</Text>
                    <Text style={styles.settingSubtext}>
                      {Platform.OS === 'ios' 
                        ? 'Triple tap screen or shake device to sign out instantly'
                        : 'Triple press back button or shake device to sign out instantly'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={panicModeEnabled}
                  onValueChange={handlePanicModeToggle}
                  disabled={isTogglingPanicMode}
                  trackColor={{ false: colors.text.muted, true: colors.accent }}
                  thumbColor={panicModeEnabled ? colors.text.primary : colors.text.secondary}
                />
              </View>
            </View>
          {/* </BlurView> */}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="dark-mode" size={24} color={colors.accent} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Theme</Text>
                <Text style={styles.settingSubtext}>
                  {themeMode === 'system' 
                    ? 'Follow system settings' 
                    : themeMode === 'light' 
                    ? 'Light mode' 
                    : 'Dark mode'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.themeSelector}
              onPress={() => {
                const modes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
                const currentIndex = modes.indexOf(themeMode);
                const nextIndex = (currentIndex + 1) % modes.length;
                setThemeMode(modes[nextIndex]);
              }}
              activeOpacity={0.7}>
              <MaterialIcons 
                name={themeMode === 'light' ? 'light-mode' : themeMode === 'dark' ? 'dark-mode' : 'brightness-auto'} 
                size={24} 
                color={colors.accent} 
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="video-label" size={24} color={colors.accent} />
              <Text style={styles.settingText}>High Quality Recording</Text>
            </View>
            <Switch
              value={highQuality}
              onValueChange={setHighQuality}
              trackColor={{ false: colors.text.muted, true: colors.accent }}
              thumbColor={highQuality ? colors.text.primary : colors.text.secondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="volume-up" size={24} color={colors.accent} />
              <Text style={styles.settingText}>Enable Sound</Text>
            </View>
            <Switch
              value={enableSound}
              onValueChange={setEnableSound}
              trackColor={{ false: colors.text.muted, true: colors.accent }}
              thumbColor={enableSound ? colors.text.primary : colors.text.secondary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          {isEditingContact ? (
            <View style={styles.emergencyForm}>
              <TextInput
                style={styles.input}
                placeholder="Emergency Contact Phone Number"
                placeholderTextColor={colors.text.muted}
                value={emergencyContact}
                onChangeText={handleEmergencyContactChange}
                keyboardType="phone-pad"
              />
              <TextInput
                style={[styles.input, styles.messageInput]}
                placeholder="Custom Emergency Message"
                placeholderTextColor={colors.text.muted}
                value={emergencyMessage}
                onChangeText={handleEmergencyMessageChange}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity style={styles.saveButton} onPress={saveEmergencySettings}>
                <Text style={styles.saveButtonText}>Save Emergency Contact</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.emergencyContactButton}
              onPress={() => router.push('/emergency-setup')}>
              <View style={styles.settingInfo}>
                <MaterialIcons name="phone" size={24} color={colors.accent} />
                <View>
                  <Text style={styles.settingText}>
                    {emergencyContact || emergencyContactName ? 'Edit Emergency Contact' : 'Set Up Emergency Contact'}
                  </Text>
                  {(emergencyContact || emergencyContactName) && (
                    <Text style={styles.messagePreview} numberOfLines={1}>
                      {emergencyContactName ? `${emergencyContactName}` : ''}{emergencyContactName && emergencyContact ? ' • ' : ''}{emergencyContact || ''}
                    </Text>
                  )}
                </View>
              </View>
              <Text style={[styles.configureText, (emergencyContact || emergencyContactName) && { position: 'absolute', right: 0, top: 15}]}>
                {(emergencyContact || emergencyContactName) ? 'Edit' : 'Configure'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="notifications" size={24} color={colors.accent} />
              <Text style={styles.settingText}>Push Notifications</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/notification-settings')}>
              <Text style={styles.configureText}>Configure</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={async () => {
              try {
                // Check notification permissions
                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;
                
                // If permission not granted, request it
                if (existingStatus !== 'granted') {
                  console.log('Requesting notification permissions...');
                  const { status } = await Notifications.requestPermissionsAsync();
                  finalStatus = status;
                }

                // If still not granted, show error
                if (finalStatus !== 'granted') {
                  console.error('Notification permission not granted');
                  alert('Please enable notifications in your device settings to receive test notifications.');
                  return;
                }

                console.log('Scheduling test notification for 3 seconds from now...');
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: 'Test Notification',
                    body: 'This is a test notification from DESIST!',
                    data: { type: 'test' },
                  },
                  trigger: {
                    seconds: 3,
                  } as Notifications.TimeIntervalTriggerInput,
                });
                console.log('Test notification scheduled successfully!');
              } catch (error) {
                console.error('Error scheduling test notification:', error);
                alert('Failed to schedule notification. Please check console for details.');
              }
            }}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="notifications" size={24} color={colors.accent} />
              <Text style={styles.settingText}>Test Notification</Text>
            </View>
            <Text style={styles.configureText}>Send Test</Text>
          </TouchableOpacity>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="notifications" size={24} color={colors.accent} />
              <Text style={styles.settingText}>Incident Alerts</Text>
            </View>
            <Switch
              value={incidentAlerts}
              onValueChange={toggleIncidentAlerts}
              trackColor={{ false: colors.text.muted, true: colors.accent }}
              thumbColor={incidentAlerts ? colors.text.primary : colors.text.secondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="location-on" size={24} color={colors.accent} />
              <Text style={styles.settingText}>Location Services</Text>
            </View>
            <Switch
              value={locationEnabled}
              onValueChange={(value) => {
                if (value) {
                  Location.requestForegroundPermissionsAsync();
                }
              }}
              trackColor={{ false: colors.text.muted, true: colors.accent }}
              thumbColor={locationEnabled ? colors.text.primary : colors.text.secondary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced</Text>
          <TouchableOpacity 
            style={styles.advancedItem}
            onPress={() => router.push('/settings-history')}>
            <View style={styles.advancedItemContent}>
              <MaterialIcons name="history" size={24} color={colors.accent} />
              <View>
                <Text style={styles.advancedItemTitle}>Settings History</Text>
                <Text style={styles.advancedItemDescription}>
                  View a log of all changes made to your settings
                </Text>
              </View>
            </View>
            <Text style={styles.advancedItemAction}>View</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About DESIST!</Text>
          <Text style={styles.infoText}>Version 1.0.0</Text>
          <Text style={styles.infoText}>© 2024 DESIST!. All rights reserved.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any, shadows: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  scrollView: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  scrollContent: {
    paddingBottom: 20, // Extra padding at the bottom
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 30,
    fontFamily: 'Inter-Bold',
  },
  profileCard: {
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 20,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: `${colors.text.muted}20`,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.accent}25`,
    borderWidth: 1,
    borderColor: `${colors.accent}60`,
  },
  avatarText: {
    color: colors.accent,
    fontSize: 20,
    fontFamily: 'Inter-Bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: colors.text.primary,
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  profileHandle: {
    color: colors.text.muted,
    fontSize: 13,
    marginTop: 2,
    fontFamily: 'Inter-Medium',
  },
  profileEmail: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'Inter-Regular',
  },
  profileActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    minHeight: 44,
    width: 'auto',
    position: 'absolute',
    top: 5,
    right: 2,
  },
  actionDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  actionButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  actionDangerText: {
    color: colors.status.error,
  },
  section: {
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 20,
    ...shadows.sm,
  },
  sectionTitle: {
    color: colors.text.muted,
    fontSize: 14,
    textTransform: 'uppercase',
    marginBottom: 15,
    fontFamily: 'Inter-Medium',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.text.muted}30`,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    flex: 1,
  },
  settingText: {
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingSubtext: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  messagePreview: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },
  emergencyForm: {
    marginTop: 10,
  },
  input: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 12,
    color: colors.text.primary,
    marginBottom: 10,
    fontFamily: 'Inter-Regular',
  },
  messageInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: colors.accent,
    padding: 15,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: 10,
    ...shadows.sm,
  },
  saveButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  logoutButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: radius.lg,
    marginTop: 15,
    gap: 8,
    ...shadows.sm,
  },
  logoutButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  emergencyContactButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.text.muted}30`,
  },
  configureText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  advancedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.text.muted}30`,
  },
  advancedItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    flex: 1,
  },
  advancedItemTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  advancedItemDescription: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'Inter-Regular',
  },
  advancedItemAction: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
    position: 'absolute',
    right: 0,
    top: 15,
  },
  infoSection: {
    marginTop: 20,
    alignItems: 'center',
  },
  infoTitle: {
    color: colors.text.muted,
    fontSize: 18,
    marginBottom: 10,
    fontFamily: 'Inter-Medium',
  },
  infoText: {
    color: colors.text.muted,
    fontSize: 14,
    marginBottom: 5,
    fontFamily: 'Inter-Regular',
  },
  // Security Section Styles
  securitySection: {
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 20,
    ...shadows.sm,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  securitySectionTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
    flex: 1,
  },
  betaBadge: {
    backgroundColor: `${colors.accent}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  betaText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'Inter-ExtraBold',
    letterSpacing: 0.5,
  },
  securitySubtitle: {
    color: colors.text.muted,
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  securityBlurWrapper: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  // Stealth Mode Styles
  stealthModeContainer: {
    // paddingVertical: 4,
    // paddingHorizontal: 15,
  },
  stealthModeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.text.muted}20`,
  },
  additionalFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.text.muted}20`,
  },
  blurredIcon: {
    opacity: 0.6,
  },
  stealthModeTextContainer: {
    flex: 1,
  },
  stealthModeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stealthModeTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
    opacity: 0.8,
  },
  stealthModeDescription: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    opacity: 0.7,
  },
  comingSoonBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  comingSoonText: {
    color: colors.text.primary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
  },
  panicModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.status.error}20`,
    padding: 12,
    borderRadius: radius.md,
    marginTop: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  panicModeButtonText: {
    color: colors.status.error,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  themeSelector: {
    padding: 8,
    borderRadius: radius.md,
  },
});
