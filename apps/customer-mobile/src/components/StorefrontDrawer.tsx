import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  StyleSheet,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import {
  STOREFRONT_BROWSE_NAV,
  MEGA_MENU_CONTENT,
  type MegaMenuLink,
  type MegaMenuPanel,
} from '@goldsmith/customer-shared';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.85, 320);

type PanelGroupDef = { labelHi: string; getLinks: (p: MegaMenuPanel) => MegaMenuLink[] };

const PANEL_GROUPS: PanelGroupDef[] = [
  { labelHi: 'लोकप्रिय',        getLinks: (p) => p.popular     },
  { labelHi: 'स्टाइल',          getLinks: (p) => p.style       },
  { labelHi: 'धातु और शुद्धता', getLinks: (p) => p.metalPurity },
  { labelHi: 'कीमत',            getLinks: (p) => p.priceBand   },
  { labelHi: 'अवसर',            getLinks: (p) => p.occasion    },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function StorefrontDrawer({ visible, onClose }: Props): React.ReactElement {
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    Animated.timing(translateX, {
      toValue:         visible ? 0 : -DRAWER_WIDTH,
      duration:        280,
      useNativeDriver: true,
    }).start(() => {
      if (!visible) setOpenKey(null);
    });
  }, [visible, translateX]);

  function navigate(href: string): void {
    onClose();
    // Map web-style /products?... paths to expo-router browse tab
    const mobilePath = href
      .replace('/products?', '/(tabs)/browse?')
      .replace('/products', '/(tabs)/browse')
      .replace('/collections', '/(tabs)/browse');
    router.push(mobilePath as Parameters<typeof router.push>[0]);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Scrim — full screen tap-to-close */}
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessible
        accessibilityLabel="बंद करें"
        accessibilityRole="button"
      />

      {/* Drawer panel */}
      <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
        {/* Header row */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ब्राउज़ करें</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            accessibilityLabel="बंद करें"
            accessibilityRole="button"
            style={styles.closeBtn}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {STOREFRONT_BROWSE_NAV.map((item) => {
            const panel = MEGA_MENU_CONTENT[item.key as keyof typeof MEGA_MENU_CONTENT];
            const isOpen = openKey === item.key;

            return (
              <View key={item.key}>
                {/* Top-level row */}
                <TouchableOpacity
                  onPress={() =>
                    panel ? setOpenKey(isOpen ? null : item.key) : navigate(item.href)
                  }
                  style={styles.navRow}
                  accessibilityRole="button"
                  accessibilityLabel={item.labelHi}
                  accessibilityState={{ expanded: panel ? isOpen : undefined }}
                >
                  <Text style={styles.navLabel}>{item.labelHi}</Text>
                  {panel && (
                    <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
                  )}
                </TouchableOpacity>

                {/* Expanded panel — 5 group shelves */}
                {panel && isOpen && (
                  <View style={styles.panelContainer}>
                    {PANEL_GROUPS.map(({ labelHi, getLinks }) => {
                      const links = getLinks(panel as MegaMenuPanel);
                      if (links.length === 0) return null;
                      return (
                        <View key={labelHi} style={styles.groupSection}>
                          <Text style={styles.groupLabel}>{labelHi}</Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.chipRow}
                          >
                            {links.map((link) => (
                              <TouchableOpacity
                                key={link.href}
                                onPress={() => navigate(link.href)}
                                style={styles.chip}
                                accessibilityRole="button"
                                accessibilityLabel={link.labelHi}
                              >
                                <Text style={styles.chipText}>{link.labelHi}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 36, 64, 0.45)',
  },
  panel: {
    position:        'absolute',
    left:            0,
    top:             0,
    bottom:          0,
    width:           DRAWER_WIDTH,
    backgroundColor: colors.bg,
    shadowColor:     '#000',
    shadowOpacity:   0.18,
    shadowRadius:    12,
    shadowOffset:    { width: 6, height: 0 },
    elevation:       12,
  },
  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontFamily: typography.headingMid.family,
    fontSize:   18,
    color:      colors.ink,
  },
  closeBtn: {
    padding:         8,
    minWidth:        44,
    minHeight:       44,
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeBtnText: {
    fontSize: 20,
    color:    colors.inkMute,
  },
  navRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    minHeight:       48,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  navLabel: {
    fontFamily: typography.headingMid.family,
    fontSize:   16,
    color:      colors.ink,
  },
  chevron: {
    color:    colors.inkMute,
    fontSize: 14,
  },
  panelContainer: {
    backgroundColor: colors.surfaceElevated,
    paddingBottom:   spacing.sm,
  },
  groupSection: {
    paddingTop: spacing.sm,
  },
  groupLabel: {
    fontFamily:    typography.body.family,
    fontSize:      11,
    color:         colors.inkSoft,
    paddingHorizontal: spacing.lg,
    marginBottom:  4,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  chipRow: {
    paddingHorizontal: spacing.lg,
    gap:               spacing.xs,
    paddingBottom:     4,
  },
  chip: {
    backgroundColor: colors.primaryWash,
    borderRadius:    radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    minHeight:       36,
    justifyContent:  'center',
    marginRight:     spacing.xs,
  },
  chipText: {
    fontFamily: typography.body.family,
    fontSize:   13,
    color:      colors.ink,
  },
});
