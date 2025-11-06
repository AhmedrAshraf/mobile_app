import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Easing, Alert, ActivityIndicator, AppState } from 'react-native';
import { useCameraPermissions, CameraView } from 'expo-camera';
import { radius } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Audio } from 'expo-av';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'do0qfrr5y';
const CLOUDINARY_UPLOAD_PRESET = 'desist';

export default function RecordScreen() {
  const { colors, shadows } = useTheme();
  const styles = getStyles(colors, shadows);
  const [permission, requestPermission] = useCameraPermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [countdownAnim] = useState(new Animated.Value(0));
  const [spinAnim] = useState(new Animated.Value(0));
  const recordingPromise = useRef<Promise<any> | null>(null);
  const recordingStartTime = useRef<number | null>(null);
  const isStoppingRef = useRef(false);
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_RECORDING_TIME = 300000; // 5 minutes in milliseconds

  useEffect(() => {
    if (isUploading) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [isUploading]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isRecording
      ) {
        console.log('App has come to the foreground!');
      }

      if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/) &&
        isRecording
      ) {
        console.log('App is going to background, saving recording...');
        handleAutoSave();
      }

      appState.current = nextAppState;
      setAppStateVisible(appState.current);
    });

    return () => {
      subscription.remove();
    };
  }, [isRecording]);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        if (isRecording) {
          console.log('User is navigating away, saving recording...');
          handleAutoSave();
        }
      };
    }, [isRecording])
  );

  // Set up auto-save timeout for long recordings
  useEffect(() => {
    if (isRecording && recordingStartTime.current) {
      const elapsedTime = Date.now() - recordingStartTime.current;
      const remainingTime = MAX_RECORDING_TIME - elapsedTime;

      if (remainingTime > 0) {
        autoSaveTimeout.current = setTimeout(() => {
          console.log('Recording time limit reached, auto-saving...');
          handleAutoSave();
        }, remainingTime);
      }
    }

    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [isRecording]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.webMessage}>
          <MaterialIcons name="error-outline" size={80} color={colors.accent} />
          <Text style={styles.permissionTitle}>Camera Not Available</Text>
          <Text style={styles.permissionText}>
            Camera recording is only available on mobile devices.
          </Text>
          <Text style={[styles.permissionText, styles.subText]}>
            Please use the iOS or Android app to record videos.
          </Text>
        </View>
      </View>
    );
  }

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <MaterialIcons name="error-outline" size={80} color={colors.accent} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need your permission to use the camera for recording incidents.
            All recordings are encrypted and stored securely.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const prepareRecording = async () => {
    try {
      console.log('Starting recording preparation...');
      if (Platform.OS === 'android') {
        console.log('Requesting audio permissions...');
        const { status: audioStatus } = await Audio.requestPermissionsAsync();
        console.log('Audio permission status:', audioStatus);
        if (audioStatus !== 'granted') {
          throw new Error('Audio recording permission is required');
        }
      }

      console.log('Setting up audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });
      console.log('Audio mode setup complete');

      return true;
    } catch (error) {
      console.error('Preparation failed:', error);
      return false;
    }
  };

  const uploadToCloudinary = async (videoUri: string) => {
    try {
      console.log('Starting Cloudinary upload...');
      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', {
        uri: videoUri,
        type: 'video/mp4',
        name: `recording-${Date.now()}.mp4`,
      } as any);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET || '');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const data = await response.json();
      console.log('Upload successful:', data);
      return data.secure_url;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const saveRecordingToSupabase = async (cloudinaryUrl: string) => {
    try {
      const { data, error } = await supabase
        .from('recordings')
        .insert([
          {
            video_url: cloudinaryUrl,
            created_at: new Date().toISOString(),
            status: 'completed'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      try {
        const existingRecordings = await AsyncStorage.getItem('userRecordings');
        const recordings = existingRecordings ? JSON.parse(existingRecordings) : [];
        recordings.push(data.id);
        await AsyncStorage.setItem('userRecordings', JSON.stringify(recordings));
      } catch (storageError) {
        console.error('Error saving to local storage:', storageError);
      }

      return data;
    } catch (error) {
      console.error('Error saving to Supabase:', error);
      throw error;
    }
  };

  const startRecording = async () => {
    console.log('Attempting to start recording...');
    if (!cameraRef.current || isRecording) return;

    try {
      console.log('Preparing recording...');
      const prepared = await prepareRecording();
      if (!prepared) return;

      setIsRecording(true);
      recordingStartTime.current = Date.now();
      
      console.log('Starting camera recording...');
      recordingPromise.current = cameraRef.current.recordAsync({
        maxDuration: 300,
      });

      // No delay here; proceed immediately after starting
    } catch (error) {
      console.error('Recording failed:', error);
      setIsRecording(false);
      recordingPromise.current = null;
      recordingStartTime.current = null;
      Alert.alert('Recording Failed', 'Unable to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    setIsProcessing(true);

    console.log('Attempting to stop recording...');
    if (!isRecording || !cameraRef.current) {
      console.log('Cannot stop — not recording');
      isStoppingRef.current = false;
      setIsProcessing(false);
      return;
    }

    try {
      const duration = Date.now() - (recordingStartTime.current ?? Date.now());
      console.log('Current recording duration:', duration, 'ms');

      if (duration < 2000) {
        console.log('Recording too short, waiting...');
        await new Promise(resolve => setTimeout(resolve, 2000 - duration));
      }

      console.log('Stopping camera recording...');
      await cameraRef.current.stopRecording();

      if (recordingPromise.current) {
        console.log('Waiting for recording promise...');
        const video = await recordingPromise.current;
        
        if (!video?.uri) {
          throw new Error('No video URI returned');
        }

        console.log('Video recorded successfully:', video.uri);
        
        // Upload to Cloudinary
        const cloudinaryUrl = await uploadToCloudinary(video.uri);
        console.log('Video uploaded to Cloudinary:', cloudinaryUrl);

        // Save to Supabase
        await saveRecordingToSupabase(cloudinaryUrl);
        console.log('Recording saved to Supabase');

        Alert.alert('Success', 'Video recorded and saved successfully!');
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to save recording. Please try again.');
    } finally {
      // Reset states and timers
      setIsRecording(false);
      setIsProcessing(false);
      recordingPromise.current = null;
      recordingStartTime.current = null;
      setIsLongPressing(false);
      setCountdown(0);
      countdownAnim.setValue(0);
      countdownInterval.current && clearInterval(countdownInterval.current);
      longPressTimer.current && clearTimeout(longPressTimer.current);
      isStoppingRef.current = false;
    }
  };

  const handlePressIn = () => {
    console.log('Button pressed, isRecording:', isRecording);
    if (isRecording) {
      const recordingDuration = recordingStartTime.current ? Date.now() - recordingStartTime.current : 0;
      console.log('Current recording duration for long press:', recordingDuration, 'ms');
      
      if (recordingDuration < 3000) {
        console.log('Recording too short, ignoring long press');
        return;
      }

      if (isProcessing || isUploading || isSaving) {
        console.log('Already processing, ignoring press');
        return;
      }

      console.log('Starting long press sequence...');
      setIsLongPressing(true);
      setCountdown(3);

      Animated.timing(countdownAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();

      countdownInterval.current = setInterval(() => {
        setCountdown(prev => {
          console.log('Countdown:', prev - 1);
          return Math.max(0, prev - 1);
        });
      }, 1000);

      longPressTimer.current = setTimeout(async () => {
        console.log('Long press timer completed, stopping recording');
        setIsSaving(true);
        await stopRecording();
      }, 3000);
    } else {
      console.log('Starting new recording');
      startRecording();
    }
  };

  const handlePressOut = () => {
    console.log('Button released, isLongPressing:', isLongPressing);
    if (isRecording && isLongPressing) {
      console.log('Cancelling long press sequence');
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
      setIsLongPressing(false);
      setCountdown(0);
      countdownAnim.setValue(0);
      setIsSaving(false);
    }
  };

  const handleAutoSave = async () => {
    if (isStoppingRef.current || !isRecording) return;
    
    try {
      console.log('Starting auto-save process...');
      setIsProcessing(true);
      setIsSaving(true);

      const duration = Date.now() - (recordingStartTime.current ?? Date.now());
      if (duration < 2000) {
        console.log('Recording too short, waiting...');
        await new Promise(resolve => setTimeout(resolve, 2000 - duration));
      }

      if (cameraRef.current) {
        console.log('Stopping camera recording for auto-save...');
        await cameraRef.current.stopRecording();

        if (recordingPromise.current) {
          const video = await recordingPromise.current;
          
          if (!video?.uri) {
            throw new Error('No video URI returned');
          }

          console.log('Video recorded successfully, uploading...');
          const cloudinaryUrl = await uploadToCloudinary(video.uri);
          console.log('Video uploaded to Cloudinary, saving to Supabase...');
          await saveRecordingToSupabase(cloudinaryUrl);
          console.log('Auto-save completed successfully');
        }
      }
    } catch (error) {
      console.error('Error during auto-save:', error);
      Alert.alert('Auto-Save Failed', 'Failed to save recording automatically. Please try recording again.');
    } finally {
      // Reset states
      setIsRecording(false);
      setIsProcessing(false);
      setIsSaving(false);
      recordingPromise.current = null;
      recordingStartTime.current = null;
      setIsLongPressing(false);
      setCountdown(0);
      countdownAnim.setValue(0);
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
      isStoppingRef.current = false;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView 
          ref={cameraRef} 
          style={styles.camera} 
          mode="video"
          videoStabilizationMode="standard"
          active={true}>
          <View style={[styles.overlay, isLongPressing && styles.overlayActive]}>
            {(isProcessing || isUploading || isSaving) && (
              <View style={styles.loadingOverlay}>
                <View style={styles.loadingContent}>
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <MaterialIcons name="cached" size={48} color={colors.accent} />
                  </Animated.View>
                  <Text style={styles.loadingText}>
                    {isSaving ? 'Saving...' : isUploading ? 'Uploading...' : 'Processing...'}
                  </Text>
                  {isUploading && (
                    <Text style={styles.loadingSubtext}>
                      {Math.round(uploadProgress)}%
                    </Text>
                  )}
                </View>
              </View>
            )}
            {isLongPressing && !isProcessing && !isUploading && !isSaving && (
              <View style={styles.countdownContainer}>
                <Animated.View
                  style={[
                    styles.countdownProgress,
                    {
                      transform: [{
                        scale: countdownAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0],
                        })
                      }],
                    }
                  ]}
                />
                <Text style={styles.countdownText}>{countdown}</Text>
              </View>
            )}
            {isRecording && !isLongPressing && !isProcessing && !isUploading && !isSaving && (
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>Recording...</Text>
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.recordButton, 
                isRecording && styles.recording,
                (isProcessing || isUploading || isSaving) && styles.recordButtonDisabled
              ]}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={isProcessing || isUploading || isSaving}
              activeOpacity={1}>
              <MaterialIcons name="video-label" color={isRecording ? colors.accent : colors.text.primary} size={32} />
              <Text style={styles.buttonText}>
                {isRecording 
                  ? (isLongPressing ? 'Hold to Save & Quit' : 'Recording...') 
                  : 'Start Record'}
              </Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    </View>
  );
}

const getStyles = (colors: any, shadows: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  cameraContainer: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    transform: [{ scale: 1 }],
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    transform: [{ scale: 1 }],
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 50,
    transform: [{ scale: 1 }],
  },
  overlayActive: {
    backgroundColor: 'transparent',
    transform: [{ scale: 1 }],
  },
  recordButton: {
    width: 110,
    height: 110,
    paddingBottom: 5,
    borderRadius: radius.round,
    backgroundColor: `${colors.accent}33`,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.accent,
    ...shadows.md,
  },
  recording: {
    backgroundColor: `${colors.accent}66`,
    borderColor: colors.accent,
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'Inter-SemiBold',
  },
  countdownContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  countdownProgress: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: radius.round,
    backgroundColor: colors.accent,
    opacity: 0.3,
  },
  countdownText: {
    color: colors.text.primary,
    fontSize: 120,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: colors.primary,
  },
  permissionTitle: {
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
  },
  permissionText: {
    color: colors.text.secondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    maxWidth: '80%',
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
  },
  permissionButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  permissionButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  webMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.primary,
  },
  subText: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 8,
    color: colors.text.secondary,
    fontFamily: 'Inter-Regular',
  },
  uploadContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}99`,
    padding: 10,
    borderRadius: radius.lg,
  },
  uploadText: {
    color: colors.text.primary,
    fontSize: 14,
    marginLeft: 8,
    fontFamily: 'Inter-Regular',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}99`,
    padding: 10,
    borderRadius: radius.lg,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    marginRight: 8,
  },
  recordingText: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  spinning: {
    transform: [{ rotate: '0deg' }],
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    fontFamily: 'Inter-Bold',
  },
  loadingSubtext: {
    color: colors.text.secondary,
    fontSize: 14,
    marginTop: 8,
    fontFamily: 'Inter-Regular',
  },
  recordButtonDisabled: {
    opacity: 0.5,
    backgroundColor: `${colors.accent}33`,
  },
});