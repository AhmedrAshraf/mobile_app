import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, Animated } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { colors, shadows, radius } from '@/constants/theme';
import { useEffect, useRef } from 'react';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

// Export the tab bar height so other components can use it for padding
export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 90 : 75;

const tabs = [
  { name: '/', title: 'Home', icon: 'home' as const, iconType: 'material' as const },
  { name: 'record', title: 'Record', icon: 'videocam' as const, iconType: 'ionicons' as const },
  { name: 'incidents', title: 'Incidents', icon: 'event-note' as const, iconType: 'material' as const },
  { name: 'documents', title: 'Documents', icon: 'description' as const, iconType: 'material' as const },
  { name: 'settings', title: 'Settings', icon: 'settings' as const, iconType: 'material' as const },
];

export default function CustomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const animatedValues = useRef(
    tabs.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    tabs.forEach((tab, index) => {
      const isActive = isTabActive(tab.name);
      Animated.spring(animatedValues[index], {
        toValue: isActive ? 1 : 0,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
    });
  }, [pathname]);

  const getTabRoute = (tabName: string) => {
    if (tabName === '/') return '/(tabs)/';
    return `/(tabs)/${tabName}`;
  };

  const isTabActive = (tabName: string) => {
    const route = getTabRoute(tabName);
    if (tabName === '/') {
      return pathname === '/(tabs)/' || pathname === '/';
    }
    return pathname === route || pathname.startsWith(route + '/');
  };

  const navigateToTab = (tabName: string) => {
    router.replace(getTabRoute(tabName) as any);
  };

  const renderIcon = (iconName: string, iconType: 'material' | 'ionicons', size: number, color: string, isActive: boolean) => {
    const iconSize = isActive ? size + 2 : size;
    
    if (iconType === 'ionicons') {
      return <Ionicons name={iconName as any} size={iconSize} color={color} />;
    }
    return <MaterialIcons name={iconName as any} size={iconSize} color={color} />;
  };

  const TabBarContent = () => (
    <View style={styles.content}>
      {tabs.map((tab, index) => {
        const isActive = isTabActive(tab.name);
        const scale = animatedValues[index].interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.05],
        });
        const opacity = animatedValues[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0.6, 1],
        });

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabButton}
            onPress={() => navigateToTab(tab.name)}
            activeOpacity={0.8}>
            <Animated.View
              style={[
                styles.tabContent,
                { transform: [{ scale }], opacity },
              ]}>
              {/* {isActive && <View style={styles.activeIndicator} />} */}
              <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
                {renderIcon(
                  tab.icon,
                  tab.iconType,
                  24,
                  isActive ? colors.accent : colors.text.muted,
                  isActive
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isActive && styles.activeTabLabel,
                ]}
                numberOfLines={1}>
                {tab.title}
              </Text>
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={95} tint="dark" style={styles.blurContainer}>
          <TabBarContent />
        </BlurView>
      ) : (
        <View style={styles.androidContainer}>
          <TabBarContent />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: TAB_BAR_HEIGHT,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  blurContainer: {
    flex: 1,
    backgroundColor: `${colors.secondary}E8`,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  androidContainer: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderTopColor: `${colors.text.muted}15`,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: 60,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    paddingHorizontal: 4,
  },
  activeIndicator: {
    position: 'absolute',
    top: -6,
    width: 36,
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    ...shadows.sm,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    padding: 8,
    borderRadius: radius.md,
  },
  activeIconContainer: {
    backgroundColor: `${colors.accent}25`,
  },
  tabLabel: {
    fontSize: 10,
    color: colors.text.muted,
    fontFamily: 'Inter-Medium',
    marginTop: 2,
    textAlign: 'center',
  },
  activeTabLabel: {
    color: colors.accent,
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
  },
});
