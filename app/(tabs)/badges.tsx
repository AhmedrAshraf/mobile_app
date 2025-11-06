import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { radius } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BadgeUnlockModal from '@/components/BadgeUnlockModal';
import { MaterialIcons } from '@expo/vector-icons';

type Badge = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
  progress?: {
    current: number;
    total: number;
  };
};

const DEFAULT_BADGES: Badge[] = [
  {
    id: 'founding_protector',
    name: 'Founding Protector',
    description: 'One of the first to join and complete safety training',
    icon: <MaterialIcons name="shield" size={32} color="#EA5455" />,
    unlocked: false
  },
  {
    id: 'shield_builder',
    name: 'Shield Builder',
    description: 'Growing the community by helping others stay safe',
    icon: <MaterialIcons name="group" size={32} color="#EA5455" />,
    unlocked: false,
    progress: {
      current: 0,
      total: 3
    }
  },
  {
    id: 'emergency_sentinel',
    name: 'Emergency Sentinel',
    description: 'Actively contributing to community safety awareness',
    icon: <MaterialIcons name="notifications" size={32} color="#EA5455" />,
    unlocked: false,
    progress: {
      current: 0,
      total: 5
    }
  },
  {
    id: 'evidence_guardian',
    name: 'Evidence Guardian',
    description: 'Helping preserve crucial evidence for justice',
    icon: <MaterialIcons name="insert-drive-file" size={32} color="#EA5455" />,
    unlocked: false,
    progress: {
      current: 0,
      total: 10
    }
  }
];

export default function BadgesScreen() {
  const { colors, shadows } = useTheme();
  const styles = getStyles(colors, shadows);
  const [badges, setBadges] = useState<Badge[]>(DEFAULT_BADGES);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock user settings data for demo purposes
      const mockUserSettings = {
        badge_founding_protector: true,
        badge_shield_builder: false,
        badge_emergency_sentinel: false,
        badge_evidence_guardian: false,
        successful_invite_count: 1,
        verified_incident_count: 2,
        public_recordings_count: 3
      };
      
      // Save to AsyncStorage for future use
      await AsyncStorage.setItem('user_badges', JSON.stringify(mockUserSettings));
      
      // Update badges state
      updateBadgesState(mockUserSettings);
    } catch (error) {
      console.error('Error loading badges:', error);
      setError('Unable to load badges. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateBadgesState = (userSettings: any) => {
    if (!userSettings) return;
    
    setBadges(prev => prev.map(badge => ({
      ...badge,
      unlocked: userSettings[`badge_${badge.id}`] || false,
      progress: badge.progress ? {
        ...badge.progress,
        current: badge.id === 'shield_builder' 
          ? (userSettings.successful_invite_count || 0)
          : badge.id === 'emergency_sentinel'
            ? (userSettings.verified_incident_count || 0)
            : badge.id === 'evidence_guardian'
              ? (userSettings.public_recordings_count || 0)
              : 0
      } : undefined
    })));
  };

  const unlockedCount = badges.filter(badge => badge.unlocked).length;

  const handleRetry = () => {
    loadBadges();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <MaterialIcons name="verified" size={32} color={colors.accent} />
          <Text style={styles.title}>My Badges</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading badges...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.progressCard}>
              <Text style={styles.progressTitle}>Badge Progress</Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { width: `${(unlockedCount / badges.length) * 100}%` }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {unlockedCount} of {badges.length} Badges Unlocked
              </Text>
            </View>

            <View style={styles.badgesGrid}>
              {badges.map(badge => (
                <TouchableOpacity
                  key={badge.id}
                  style={[
                    styles.badgeCard,
                    badge.unlocked && styles.unlockedBadge
                  ]}
                  onPress={() => {
                    setSelectedBadge(badge);
                    setShowUnlockModal(true);
                  }}>
                  <View style={styles.badgeHeader}>
                    <View style={styles.badgeIcon}>
                      {badge.icon}
                    </View>
                    {!badge.unlocked && (
                      <MaterialIcons name="lock" size={20} color={colors.text.muted} />
                    )}
                  </View>
                  <Text style={styles.badgeName}>{badge.name}</Text>
                  <Text style={styles.badgeDescription}>
                    {badge.description}
                  </Text>
                  {badge.progress && (
                    <View style={styles.progressContainer}>
                      <View style={styles.badgeProgressBar}>
                        <View 
                          style={[
                            styles.badgeProgressFill,
                            { 
                              width: `${Math.min(100, (badge.progress.current / badge.progress.total) * 100)}%` 
                            }
                          ]}
                        />
                      </View>
                      <Text style={styles.badgeProgressText}>
                        {badge.progress.current}/{badge.progress.total}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.comingSoon}>
              More badges coming soon...
            </Text>
          </>
        )}
        
        {/* Add spacer at the bottom to account for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      <BadgeUnlockModal
        visible={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        badge={selectedBadge}
      />
    </View>
  );
}

const getStyles = (colors: any, shadows: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  scrollContent: {
    paddingBottom: 20, // Additional padding at the bottom
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    gap: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text.primary,
    fontFamily: 'Inter-Bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text.secondary,
    fontFamily: 'Inter-Regular',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: colors.status.error,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Inter-Regular',
  },
  retryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  retryButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  progressCard: {
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 30,
    ...shadows.sm,
  },
  progressTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    fontFamily: 'Inter-SemiBold',
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.round,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.round,
  },
  progressText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginBottom: 30,
  },
  badgeCard: {
    width: '47%',
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    padding: 15,
    ...shadows.sm,
  },
  unlockedBadge: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  badgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.round,
    backgroundColor: `${colors.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeName: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
  },
  badgeDescription: {
    color: colors.text.muted,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 15,
    fontFamily: 'Inter-Regular',
  },
  progressContainer: {
    gap: 5,
  },
  badgeProgressBar: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.round,
    overflow: 'hidden',
  },
  badgeProgressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.round,
  },
  badgeProgressText: {
    color: colors.text.muted,
    fontSize: 12,
    textAlign: 'right',
    fontFamily: 'Inter-Regular',
  },
  comingSoon: {
    color: colors.text.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    fontFamily: 'Inter-Regular',
  },
});