import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator, Platform, RefreshControl } from 'react-native';
import { darkColors, radius } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState } from 'react';
import { getNews, NewsItem } from '@/lib/news';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';
type Incident = {
  id: string;
  type: string;
  description: string;
  created_at: string;
};

export default function HomeScreen() {
  const { colors, shadows } = useTheme();
  const { user, userProfile } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState({
    incidents: 0,
    documents: 0,
    badges: 0,
    recentCount: 0,
  });
  const [checklist, setChecklist] = useState({
    emergencyContact: false,
    incidentBackup: false,
    documentsOrganized: false,
    legalRightsReviewed: false,
  });
  const [protectionScore, setProtectionScore] = useState(0);
  const [rightsTipIndex, setRightsTipIndex] = useState(0);

  const rightsTips = [
    {
      title: 'Right to Remain Silent',
      tip: 'You have the right to remain silent. You can say "I wish to remain silent" and ask for a lawyer.',
      icon: 'volume-off',
    },
    {
      title: 'Right to Refuse Search',
      tip: 'You can refuse searches without a warrant. Say "I do not consent to this search."',
      icon: 'search-off',
    },
    {
      title: 'Right to an Attorney',
      tip: 'You have the right to speak with an attorney before answering questions. Always request one.',
      icon: 'gavel',
    },
    {
      title: 'Right to Record',
      tip: 'In most places, you can legally record interactions with police in public spaces.',
      icon: 'videocam',
    },
    {
      title: 'Right to Ask Questions',
      tip: 'You can always ask "Am I free to go?" If yes, calmly leave. If no, ask why you\'re being detained.',
      icon: 'help-outline',
    },
    {
      title: 'Document Everything',
      tip: 'Record badge numbers, names, and details. Document everything immediately after an incident.',
      icon: 'description',
    },
  ];

  useEffect(() => {
    loadData();
    loadChecklist();
    calculateProtectionScore();
    // Rotate rights tip daily
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    setRightsTipIndex(dayOfYear % rightsTips.length);
  }, [user?.id]);

  const loadData = async () => {
    await Promise.all([loadNews(), loadStats(), loadRecentIncidents()]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loadRecentIncidents = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('id, type, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (!error && data) {
        setRecentIncidents(data);
        // Count incidents from last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentCount = data.filter(
          (incident) => new Date(incident.created_at) >= sevenDaysAgo
        ).length;
        setStats((prev) => ({ ...prev, recentCount }));
      }
    } catch (error) {
      console.error('Error loading recent incidents:', error);
    }
  };

  const loadStats = async () => {
    if (!user?.id) return;
    
    try {
      const { count: incidentsCount } = await supabase
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setStats((prev) => ({
        ...prev,
        incidents: incidentsCount || 0,
      }));
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadNews = async () => {
    try {
      setLoading(true);
      const newsItems = await getNews(1, 3);
      setNews(newsItems);
    } catch (error) {
      console.error('Error loading news:', error);
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewsPress = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getMotivationalMessage = () => {
    const messages = [
      'Your safety matters. Keep documenting.',
      'Stay informed. Stay protected.',
      'Knowledge is your best defense.',
      'Every incident documented makes a difference.',
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const firstName = userProfile?.full_name?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || 'there';

  const quickActions = [
    {
      id: 'report',
      title: 'Report Incident',
      description: 'Document a new incident',
      icon: 'report',
      color: colors.status.error,
      route: '/report-incident',
    },
    {
      id: 'record',
      title: 'Record',
      description: 'Start recording',
      icon: 'videocam',
      color: colors.accent,
      route: '/record',
    },
    {
      id: 'incidents',
      title: 'My Incidents',
      description: 'View all incidents',
      icon: 'event-note',
      color: colors.status.success,
      route: '/incidents',
    },
    {
      id: 'documents',
      title: 'Documents',
      description: 'Access files',
      icon: 'description',
      color: colors.status.warning,
      route: '/documents',
    },
    {
      id: 'legal',
      title: 'Legal Help',
      description: 'Get assistance',
      icon: 'gavel',
      color: colors.accent,
      route: '/legal-help',
    },
    {
      id: 'badges',
      title: 'Badges',
      description: 'View achievements',
      icon: 'workspace-premium',
      color: colors.status.success,
      route: '/badges',
    },
  ];

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const loadChecklist = async () => {
    try {
      const today = new Date().toDateString();
      const stored = await AsyncStorage.getItem(`checklist_${today}`);
      if (stored) {
        setChecklist(JSON.parse(stored));
      } else {
        // Reset checklist for new day
        setChecklist({
          emergencyContact: false,
          incidentBackup: false,
          documentsOrganized: false,
          legalRightsReviewed: false,
        });
      }
    } catch (error) {
      console.error('Error loading checklist:', error);
    }
  };

  const toggleChecklistItem = async (key: keyof typeof checklist) => {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem(`checklist_${today}`, JSON.stringify(updated));
      calculateProtectionScore();
    } catch (error) {
      console.error('Error saving checklist:', error);
    }
  };

  const calculateProtectionScore = async () => {
    if (!user?.id) return;
    
    try {
      let score = 0;
      
      // Check emergency contact setup
      const { data: userData } = await supabase
        .from('users')
        .select('emergency_contact_phone, emergency_call_code')
        .eq('id', user.id)
        .single();
      
      if (userData?.emergency_contact_phone) score += 25;
      if (userData?.emergency_call_code) score += 15;
      
      // Check incident documentation
      if (stats.incidents > 0) score += 20;
      
      // Check checklist completion
      const completedItems = Object.values(checklist).filter(Boolean).length;
      score += completedItems * 10;
      
      // Check if has recent activity
      if (stats.recentCount > 0) score += 10;
      
      setProtectionScore(Math.min(score, 100));
    } catch (error) {
      console.error('Error calculating protection score:', error);
    }
  };

  useEffect(() => {
    calculateProtectionScore();
  }, [checklist, stats.incidents, user?.id]);

  const checklistItems = [
    {
      key: 'emergencyContact' as const,
      label: 'Verify emergency contact',
      route: '/emergency-setup',
      icon: 'phone',
    },
    {
      key: 'incidentBackup' as const,
      label: 'Backup recent incidents',
      route: '/incidents',
      icon: 'cloud-upload',
    },
    {
      key: 'documentsOrganized' as const,
      label: 'Organize documents',
      route: '/documents',
      icon: 'folder',
    },
    {
      key: 'legalRightsReviewed' as const,
      label: 'Review legal rights',
      route: '/legal-help',
      icon: 'article',
    },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return colors.status.success;
    if (score >= 50) return colors.status.warning;
    return colors.status.error;
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 50) return 'Good';
    if (score >= 25) return 'Fair';
    return 'Needs Improvement';
  };

  const styles = getStyles(colors, shadows);

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }>
      
      {/* Hero Banner */}
      <LinearGradient
        colors={[`${colors.accent}15`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBanner}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.greetingRow}>
              <Text style={styles.tagline}>{getGreeting()}, <Text style={styles.userName}>{firstName} 👋</Text></Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Protected</Text>
              </View>
            </View>
            {/* <Text style={styles.userName}>{firstName} 👋</Text> */}
            <Text style={styles.tagline}>{getMotivationalMessage()}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* DESIST! Marketing Banner */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.desistBanner}
          onPress={() => {
            // Could navigate to about page or website
          }}
          activeOpacity={0.9}>
          <LinearGradient
            colors={['#2D4059', `${'#2D4059'}`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.desistBannerGradient}>
            <View style={styles.desistBannerContent}>
              <View style={styles.desistBannerLeft}>
                {/* <View style={styles.desistLogoContainer}> */}
                  {/* <MaterialIcons name="shield" size={48} color={darkColors.text.primary} /> */}
                  <Image source={require('@/assets/images/favicon.png')} style={styles.desistLogo} />
                {/* </View> */}
                <View style={styles.desistTextContainer}>
                  <Text style={styles.desistBannerTitle}>DESIST!</Text>
                  <Text style={styles.desistBannerSubtitle}>Your Digital Safety Companion</Text>
                  <Text style={styles.desistBannerTagline}>Empowering everyone to protect their rights and data</Text>
                </View>
              </View>
              <View style={styles.desistBannerRight}>
                <MaterialIcons name="arrow-forward" size={32} color={darkColors.text.primary} />
              </View>
            </View>
            <View style={styles.desistBannerFeatures}>
              <View style={styles.desistFeature}>
                <MaterialIcons name="lock" size={20} color={darkColors.text.primary} />
                <Text style={styles.desistFeatureText}>Secure</Text>
              </View>
              <View style={styles.desistFeature}>
                <MaterialIcons name="privacy-tip" size={20} color={darkColors.text.primary} />
                <Text style={styles.desistFeatureText}>Private</Text>
              </View>
              <View style={styles.desistFeature}>
                <MaterialIcons name="verified-user" size={20} color={darkColors.text.primary} />
                <Text style={styles.desistFeatureText}>Trusted</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Emergency Quick Access */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.emergencyCard}
          onPress={() => router.push('/emergency-setup')}
          activeOpacity={0.9}>
          <LinearGradient
            colors={[colors.status.error, `${colors.status.error}DD`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emergencyGradient}>
            <View style={styles.emergencyContent}>
              <View style={styles.emergencyIconContainer}>
                <MaterialIcons name="emergency" size={32} color={colors.text.primary} />
              </View>
              <View style={styles.emergencyTextContainer}>
                <Text style={styles.emergencyTitle}>Emergency Setup</Text>
                <Text style={styles.emergencySubtitle}>Configure your emergency contact</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.text.primary} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Protection Score & Daily Checklist */}
      <View style={styles.section}>
        <View style={styles.protectionCard}>
          <LinearGradient
            colors={[`${getScoreColor(protectionScore)}20`, `${getScoreColor(protectionScore)}05`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.protectionGradient}>
            <View style={styles.protectionHeader}>
              <View style={styles.protectionIconContainer}>
                <MaterialIcons name="shield" size={24} color={getScoreColor(protectionScore)} />
              </View>
              <View style={styles.protectionInfo}>
                <Text style={styles.protectionTitle}>Protection Score</Text>
                <View style={styles.protectionScoreRow}>
                  <Text style={[styles.protectionLabel, { color: getScoreColor(protectionScore) }]}>
                    {getScoreLabel(protectionScore)}
                  </Text>
                  <Text style={[styles.scoreTextSmall, { color: getScoreColor(protectionScore) }]}>
                    {protectionScore}%
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.scoreBarContainer}>
              <View style={[styles.scoreBarFill, { 
                width: `${protectionScore}%`,
                backgroundColor: getScoreColor(protectionScore),
              }]} />
            </View>
            
            <View style={styles.checklistCompact}>
              <View style={styles.checklistHeader}>
                <Text style={styles.checklistTitleSmall}>Daily Checklist</Text>
                <Text style={styles.checklistProgressSmall}>
                  {Object.values(checklist).filter(Boolean).length}/{checklistItems.length}
                </Text>
              </View>
              <View style={styles.checklistGrid}>
                {checklistItems.map((item) => {
                  const isChecked = checklist[item.key];
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.checklistItemSmall, isChecked && styles.checklistItemCompletedSmall]}
                      onPress={() => {
                        if (!isChecked) {
                          toggleChecklistItem(item.key);
                          router.push(item.route as any);
                        } else {
                          toggleChecklistItem(item.key);
                        }
                      }}
                      activeOpacity={0.7}>
                      {isChecked ? (
                        <MaterialIcons name="check-circle" size={18} color={colors.status.success} />
                      ) : (
                        <MaterialIcons name={item.icon as any} size={16} color={colors.text.muted} />
                      )}
                      <Text style={[styles.checklistLabelSmall, isChecked && styles.checklistLabelCompletedSmall]} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* Today's Rights Tip */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.rightsTipCard}
          onPress={() => router.push('/legal-help')}
          activeOpacity={0.8}>
          <LinearGradient
            colors={[`${colors.accent}25`, `${colors.accent}10`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.rightsTipGradient}>
            <View style={styles.rightsTipHeader}>
              <View style={styles.rightsTipIconContainer}>
                <MaterialIcons 
                  name={rightsTips[rightsTipIndex].icon as any} 
                  size={32} 
                  color={colors.accent} 
                />
              </View>
              <View style={styles.rightsTipBadge}>
                <MaterialIcons name="lightbulb" size={16} color={colors.accent} />
                <Text style={styles.rightsTipBadgeText}>Daily Tip</Text>
              </View>
            </View>
            <Text style={styles.rightsTipTitle}>{rightsTips[rightsTipIndex].title}</Text>
            <Text style={styles.rightsTipText}>{rightsTips[rightsTipIndex].tip}</Text>
            <View style={styles.rightsTipFooter}>
              <Text style={styles.rightsTipLink}>Learn more about your rights</Text>
              <MaterialIcons name="arrow-forward" size={18} color={colors.accent} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.section}>
        <View style={styles.statsContainer}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/incidents')}
            activeOpacity={0.7}>
            <View style={[styles.statIconContainer, { backgroundColor: `${colors.accent}20` }]}>
              <MaterialIcons name="event-note" size={24} color={colors.accent} />
            </View>
            <Text style={styles.statNumber}>{stats.incidents}</Text>
            <Text style={styles.statLabel}>Total Incidents</Text>
            {stats.recentCount > 0 && (
              <View style={styles.statBadge}>
                <Text style={styles.statBadgeText}>+{stats.recentCount} this week</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/documents')}
            activeOpacity={0.7}>
            <View style={[styles.statIconContainer, { backgroundColor: `${colors.status.warning}20` }]}>
              <MaterialIcons name="description" size={24} color={colors.status.warning} />
            </View>
            <Text style={styles.statNumber}>{stats.documents}</Text>
            <Text style={styles.statLabel}>Documents</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/badges')}
            activeOpacity={0.7}>
            <View style={[styles.statIconContainer, { backgroundColor: `${colors.status.success}20` }]}>
              <MaterialIcons name="workspace-premium" size={24} color={colors.status.success} />
            </View>
            <Text style={styles.statNumber}>{stats.badges}</Text>
            <Text style={styles.statLabel}>Badges</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      {recentIncidents.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <Text style={styles.sectionSubtitle}>Your latest incidents</Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/incidents')}
              activeOpacity={0.7}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.activityContainer}>
            {recentIncidents.map((incident, index) => (
              <TouchableOpacity
                key={incident.id}
                style={styles.activityCard}
                onPress={() => router.push(`/incidents/${incident.id}` as any)}
                activeOpacity={0.7}>
                <View style={styles.activityIcon}>
                  <MaterialIcons name="event-note" size={20} color={colors.accent} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {incident.type || 'Incident'}
                  </Text>
                  <Text style={styles.activityDescription} numberOfLines={1}>
                    {incident.description || 'No description'}
                  </Text>
                </View>
                <Text style={styles.activityTime}>{formatTimeAgo(incident.created_at)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.quickActionCard}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.7}>
              <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}20` }]}>
                <MaterialIcons name={action.icon as any} size={28} color={action.color} />
              </View>
              <Text style={styles.quickActionTitle}>{action.title}</Text>
              <Text style={styles.quickActionDescription}>{action.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* News Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Latest Updates</Text>
            <Text style={styles.sectionSubtitle}>Stay informed with the latest news</Text>
          </View>
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => router.push('/blogs')}
            activeOpacity={0.7}>
            <Text style={styles.viewAllText}>View All</Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingText}>Loading news...</Text>
          </View>
        ) : news.length > 0 ? (
          <View style={styles.newsContainer}>
            {news.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.newsCard, index === news.length - 1 && styles.lastNewsCard]}
                onPress={() => handleNewsPress(item.url)}
                activeOpacity={0.7}>
                <View style={styles.newsContent}>
                  <View style={styles.newsHeader}>
                    <View style={styles.newsSourceBadge}>
                      <Text style={styles.newsSourceText}>{item.source}</Text>
                    </View>
                    <Text style={styles.newsDate}>
                      {new Date(item.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </Text>
                  </View>
                  <Text style={styles.newsItemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.newsItemDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <View style={styles.newsFooter}>
                    <MaterialIcons name="arrow-forward" size={16} color={colors.accent} />
                    <Text style={styles.readMoreText}>Read more</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="article" size={48} color={colors.text.muted} />
            <Text style={styles.emptyText}>No news available</Text>
          </View>
        )}
      </View>

      {/* Bottom Spacing */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const getStyles = (colors: any, shadows: any) => StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: colors.primary,
    backgroundColor: '#f0f7ff',
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  heroBanner: {
    marginBottom: 24,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerContent: {
    marginTop: 8,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  greeting: {
    fontSize: 16,
    color: colors.text.muted,
    fontFamily: 'Inter-Regular',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.status.success}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.success,
  },
  statusText: {
    fontSize: 11,
    color: colors.status.success,
    fontFamily: 'Inter-SemiBold',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    fontFamily: 'Inter-Bold',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: colors.text.secondary,
    fontFamily: 'Inter-Regular',
    lineHeight: 24,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text.primary,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.text.muted,
    fontFamily: 'Inter-Regular',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.accent,
    fontFamily: 'Inter-SemiBold',
  },
  emergencyCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  emergencyGradient: {
    padding: 20,
  },
  emergencyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  emergencyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: `${colors.text.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyTextContainer: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  emergencySubtitle: {
    fontSize: 14,
    color: colors.text.primary,
    opacity: 0.8,
    fontFamily: 'Inter-Regular',
  },
  desistBanner: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.lg,
  },
  desistBannerGradient: {
    padding: 24,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${colors.accent}20`,
    ...shadows.lg,
    borderStyle: 'solid',
  },
  desistBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  desistBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  desistLogoContainer: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: `${colors.text.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  desistTextContainer: {
    flex: 1,
  },
  desistBannerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 4,
    fontFamily: 'Inter-Bold',
    letterSpacing: 1,
  },
  desistBannerSubtitle: {
    fontSize: 16,
    color: darkColors.text.primary,
    opacity: 0.95,
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  desistBannerTagline: {
    fontSize: 13,
    color: darkColors.text.primary,
    opacity: 0.85,
    fontFamily: 'Inter-Regular',
  },
  desistBannerRight: {
    padding: 8,
  },
  desistBannerFeatures: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: `${darkColors.text.primary}20`,
  },
  desistFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  desistFeatureText: {
    fontSize: 13,
    color: darkColors.text.primary,
    opacity: 0.9,
    fontFamily: 'Inter-Medium',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: darkColors.secondary,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
    ...shadows.sm,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: darkColors.text.primary,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.muted,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  statBadge: {
    marginTop: 8,
    backgroundColor: `${colors.accent}20`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  statBadgeText: {
    fontSize: 10,
    color: colors.accent,
    fontFamily: 'Inter-SemiBold',
  },
  activityContainer: {
    gap: 12,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
    ...shadows.sm,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: `${colors.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    fontFamily: 'Inter-Regular',
  },
  activityTime: {
    fontSize: 12,
    color: colors.text.muted,
    fontFamily: 'Inter-Regular',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    width: '47%',
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    padding: 20,
    alignItems: 'center',
    ...shadows.sm,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
    marginBottom: 4,
  },
  quickActionDescription: {
    fontSize: 12,
    color: colors.text.muted,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  newsContainer: {
    gap: 12,
  },
  newsCard: {
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  lastNewsCard: {
    marginBottom: 0,
  },
  newsContent: {
    padding: 16,
  },
  newsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  newsSourceBadge: {
    backgroundColor: `${colors.accent}20`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  newsSourceText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
    textTransform: 'uppercase',
  },
  newsDate: {
    fontSize: 12,
    color: colors.text.muted,
    fontFamily: 'Inter-Regular',
  },
  newsItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
    lineHeight: 22,
  },
  newsItemDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
    marginBottom: 12,
  },
  newsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  readMoreText: {
    fontSize: 14,
    color: colors.accent,
    fontFamily: 'Inter-SemiBold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.muted,
    fontFamily: 'Inter-Regular',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.muted,
    fontFamily: 'Inter-Regular',
    marginTop: 16,
  },
  bottomSpacing: {
    height: 20,
  },
  protectionCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  protectionGradient: {
    padding: 16,
  },
  protectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  protectionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: `${colors.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  protectionInfo: {
    flex: 1,
  },
  protectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    fontFamily: 'Inter-Bold',
    marginBottom: 2,
  },
  protectionLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  protectionScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreTextSmall: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  scoreBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: `${colors.text.muted}20`,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: 12,
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: radius.sm,
  },
  checklistCompact: {
    marginTop: 4,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  checklistTitleSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    fontFamily: 'Inter-SemiBold',
  },
  checklistProgressSmall: {
    fontSize: 12,
    color: colors.accent,
    fontFamily: 'Inter-SemiBold',
  },
  checklistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checklistItemSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    padding: 8,
    paddingHorizontal: 10,
    gap: 6,
    flex: 1,
    minWidth: '47%',
    ...shadows.sm,
  },
  checklistItemCompletedSmall: {
    backgroundColor: `${colors.status.success}15`,
  },
  checklistLabelSmall: {
    fontSize: 11,
    color: colors.text.primary,
    fontFamily: 'Inter-Medium',
    flex: 1,
  },
  checklistLabelCompletedSmall: {
    color: colors.text.secondary,
    textDecorationLine: 'line-through',
  },
  rightsTipCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  rightsTipGradient: {
    padding: 20,
  },
  rightsTipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  rightsTipIconContainer: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: `${colors.accent}30`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightsTipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.accent}20`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    gap: 6,
  },
  rightsTipBadgeText: {
    fontSize: 12,
    color: colors.accent,
    fontFamily: 'Inter-SemiBold',
  },
  rightsTipTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    fontFamily: 'Inter-Bold',
    marginBottom: 8,
  },
  rightsTipText: {
    fontSize: 15,
    color: colors.text.secondary,
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
    marginBottom: 16,
  },
  rightsTipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rightsTipLink: {
    fontSize: 14,
    color: colors.accent,
    fontFamily: 'Inter-SemiBold',
  },
  desistLogo: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    // backgroundColor: `${darkColors.text.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

