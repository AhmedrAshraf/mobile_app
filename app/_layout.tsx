import { useEffect, useState, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import EmergencyCallButton from '@/components/EmergencyCallButton';
import CustomSplashScreen from '@/components/SplashScreen';
import BiometricLogin from '@/components/BiometricLogin';
import { View, Text } from 'react-native'
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { StealthModeProvider, useStealthMode } from '@/components/StealthModeManager';
import { BiometricLoginProvider, useBiometricLogin } from '@/components/BiometricLoginProvider';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { usePanicModeGesture } from '@/hooks/usePanicModeGesture';
import { PanicModeTripleTap } from '@/components/PanicModeTripleTap';


// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors - this happens on web
});

function AppContent() {
  useFrameworkReady();
  const router = useRouter();
  const { colors } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const { isLocked, unlock, biometricLoginEnabled, isInitializing } = useBiometricLogin();
  const { isActive: isStealthModeActive } = useStealthMode();
  
  // Enable panic mode gesture detection
  usePanicModeGesture();
  
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const hasCheckedRouteRef = useRef(false);
  const previousUserRef = useRef<string | null>(null);
  const isLogoutRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset route check if user state changed (sign in/sign out)
    const currentUserId = user?.id || null;
    
    // Detect logout: user was logged in, now logged out
    isLogoutRef.current = previousUserRef.current !== null && currentUserId === null;
    
    if (previousUserRef.current !== currentUserId) {
      console.log('User state changed, resetting route check');
      hasCheckedRouteRef.current = false;
      setIsReady(false); // Reset ready state to trigger re-check
      setInitialRoute(null); // Reset route to trigger navigation
      previousUserRef.current = currentUserId;
    }

    if (!hasCheckedRouteRef.current && !authLoading && !isInitializing) {
      console.log('AppContent mounted, checking authentication...');
      checkInitialRoute();
    }
  }, [user, authLoading, isInitializing]);

  const checkInitialRoute = async () => {
    if (hasCheckedRouteRef.current) return; // Prevent multiple calls
    
    try {
      console.log('Checking authentication status...');

      if (authLoading) {
        console.log('Auth is still loading...');
        return; // Will retry when authLoading changes
      }

      // Mark as checked to prevent re-entry
      hasCheckedRouteRef.current = true;

      // Check if stealth mode is active first
      const stealthModeActive = await AsyncStorage.getItem('stealth_mode_active');
      if (stealthModeActive === 'true') {
        console.log('Stealth mode is active, setting initial route to calculator');
        setInitialRoute('/stealth-calculator');
        setIsReady(true);
        return;
      }

      // Check if user just logged out (previousUserRef had a user, now user is null)
      const isLogout = isLogoutRef.current;
      
      // Check onboarding FIRST (before authentication) - but only on first app launch, not after logout
      if (!isLogout) {
        const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
        console.log('Onboarding completed:', onboardingCompleted);
        
        if (onboardingCompleted !== 'true') {
          console.log('Onboarding not completed, showing onboarding first');
          setInitialRoute('/onboarding');
          setIsReady(true);
          return;
        }
      } else {
        console.log('User logged out, skipping onboarding check');
      }

      // Onboarding is completed (or user logged out), now check authentication
      if (user && user.id) {
        console.log('User is authenticated, navigating to tabs');
        setInitialRoute('/(tabs)');
      } else {
        console.log('User not authenticated, navigating to login');
        setInitialRoute('/login');
      }

      // Reset logout flag after handling
      isLogoutRef.current = false;

      // Set ready state immediately after determining route
      console.log('Setting isReady to true');
      setIsReady(true);
    } catch (error) {
      console.error('Error checking initial route:', error);
      setInitialRoute('/login'); // Default to login on error
      setIsReady(true);
      hasCheckedRouteRef.current = true;
    }
  };

  useEffect(() => {
    if (isReady && initialRoute && !isLocked && !isInitializing) {
      console.log('App is ready, navigating to:', initialRoute);
      // Use a small delay to ensure navigation happens smoothly
      const timer = setTimeout(() => {
        router.replace(initialRoute as any);
        // Hide the native splash screen once navigation is complete
        SplashScreen.hideAsync().catch(() => {
          // Ignore errors - this happens on web
        });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isReady, initialRoute, isLocked, isInitializing]);

  if (!isReady || !initialRoute || authLoading || isInitializing) {
    console.log('Showing splash screen - isReady:', isReady, 'initialRoute:', initialRoute, 'authLoading:', authLoading, 'isInitializing:', isInitializing);
    return <CustomSplashScreen />;
  }

  console.log('Rendering main layout');
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanicModeTripleTap>
        <Stack screenOptions={{ 
          headerShown: false,
          contentStyle: { backgroundColor: colors.primary }
        }}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="emergency-setup" options={{ presentation: 'modal' }} />
          <Stack.Screen name="panic-activation" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="report-incident" options={{ presentation: 'modal' }} />
          <Stack.Screen name="legal-rights" options={{ presentation: 'modal' }} />
          <Stack.Screen name="stealth-mode" options={{ presentation: 'modal' }} />
          <Stack.Screen name="stealth-calculator" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="stealth-settings" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="incidents" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="badge-unlock" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="light" />
        {initialRoute !== '/login' && initialRoute !== '/signup' && initialRoute !== '/onboarding' && initialRoute !== '/auth/confirmation' && initialRoute !== '/stealth-calculator' && !isStealthModeActive && <EmergencyCallButton />}
        
        {/* Biometric Login Modal */}
        {user && biometricLoginEnabled && (
          <BiometricLogin
            visible={isLocked}
            onSuccess={unlock}
            onFail={() => {
              // Stay locked if authentication fails
            }}
          />
        )}
      </PanicModeTripleTap>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BiometricLoginProvider>
          <StealthModeProvider>
            <AppContent />
          </StealthModeProvider>
        </BiometricLoginProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}