/**
 * RootErrorBoundary.tsx — React class-based Error Boundary for customer-mobile.
 *
 * Story 19.2 requirements:
 *  - Catches any component render error that would otherwise white-screen
 *  - Renders a Hindi-first fallback UI (per CLAUDE.md Hindi-first rule)
 *  - Reports to Sentry with `errorBoundary: true` tag
 *  - Touch targets ≥ 48dp (per CLAUDE.md 48dp rule)
 *  - No color-only signals (icon + text, not color alone)
 *  - App must NOT white-screen on catch
 *
 * Design notes:
 *  - Warm cream background matches Direction 05 Hindi-First Editorial palette
 *  - Yatra One / MuktaVaani fonts per the locked UX direction
 *  - No Goldsmith branding visible (white-label rule)
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Sentry } from '../lib/sentry';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  reported: boolean;
}

export class RootErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, reported: false };
  }

  static getDerivedStateFromError(_error: unknown): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Tag the event so dashboards can filter boundary-caught crashes separately
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', 'true');
      scope.setExtra('componentStack', info.componentStack ?? '');
      Sentry.captureException(error);
    });
    this.setState({ reported: true });
  }

  handleRetry = (): void => {
    // Clear the error state so the tree can re-render.
    // Note: if the underlying bug persists, this will catch again immediately —
    // that is the correct behaviour (loop shows fallback again rather than crashing).
    this.setState({ hasError: false, reported: false });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container} accessibilityRole="alert">
          {/* Warning icon — Unicode glyph, no color-only signal */}
          <Text style={styles.icon} accessibilityElementsHidden>
            ⚠
          </Text>

          {/* Primary Hindi message */}
          <Text style={styles.heading} accessibilityLabel="कुछ गलत हुआ, कृपया ऐप फिर खोलें">
            कुछ गलत हुआ
          </Text>
          <Text style={styles.subheading}>
            कृपया ऐप फिर खोलें
          </Text>

          {/* Sentry report confirmation — shown once event is captured */}
          {this.state.reported ? (
            <Text style={styles.reportedBadge} accessibilityLiveRegion="polite">
              ✓ रिपोर्ट भेजी गई
            </Text>
          ) : null}

          {/* Retry action — ≥ 48dp touch target */}
          <Pressable
            onPress={this.handleRetry}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="पुनः प्रयास करें"
            hitSlop={8}
          >
            <Text style={styles.retryText}>पुनः प्रयास करें</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5EDDD', // Direction 05 cream — matches the locked palette
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  icon: {
    fontSize: 48,
    lineHeight: 56,
    color: '#7C5C2E', // warm brown — accessible contrast on cream (> 4.5:1)
    marginBottom: 8,
  },
  heading: {
    fontFamily: 'YatraOne',
    fontSize: 24,
    lineHeight: 32,
    color: '#3B2507',
    textAlign: 'center',
    fontWeight: '400',
  },
  subheading: {
    fontFamily: 'MuktaVaani-400',
    fontSize: 16,
    lineHeight: 24,
    color: '#5C3D1A',
    textAlign: 'center',
  },
  reportedBadge: {
    fontFamily: 'MuktaVaani-400',
    fontSize: 14,
    lineHeight: 20,
    color: '#2D6A4F', // accessible green on cream — text + icon, not color only (✓ prefix)
    marginTop: 4,
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#7C5C2E',
    paddingVertical: 14,    // total height 14+14+font ≥ 48dp
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 160,
    alignItems: 'center',
  },
  retryText: {
    fontFamily: 'MuktaVaani-600',
    fontSize: 16,
    lineHeight: 20,
    color: '#FFFBF5',
    fontWeight: '600',
  },
});
