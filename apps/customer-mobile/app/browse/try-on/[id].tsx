import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';

type PermState = 'checking' | 'granted' | 'denied';

export default function MobileTryOnScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [perm, setPerm] = useState<PermState>('checking');

  const webBaseUrl = (Constants.expoConfig?.extra?.['webBaseUrl'] as string | undefined) ?? '';
  const tenantSlug = (Constants.expoConfig?.extra?.['tenantSlug'] as string | undefined) ?? '';
  const uri = `${webBaseUrl}/products/${id}/try-on-wv?shop=${encodeURIComponent(tenantSlug)}`;

  useEffect(() => {
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const cam = require('expo-camera') as {
          Camera: { requestCameraPermissionsAsync: () => Promise<{ status: string }> };
        };
        const { status } = await cam.Camera.requestCameraPermissionsAsync();
        setPerm(status === 'granted' ? 'granted' : 'denied');
      } catch {
        // expo-camera not linked — let the WebView prompt handle it.
        setPerm('granted');
      }
    })();
  }, []);

  const onMessage = (e: WebViewMessageEvent): void => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type?: string };
      if (msg.type === 'tryon-close') router.back();
    } catch {
      // ignore non-JSON messages
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="बंद करें"
          accessibilityRole="button"
          style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 22, color: '#fff' }}>✕</Text>
        </TouchableOpacity>
        <Text style={{ marginLeft: spacing.sm, fontFamily: typography.serif.family, fontSize: 16, color: '#fff' }}>
          ट्राय करके देखें
        </Text>
      </View>

      {perm === 'checking' && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {perm === 'denied' && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md }}>
          <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: '#fff', textAlign: 'center' }}>
            कैमरा अनुमति नहीं मिली। सेटिंग्स में कैमरा चालू करें और फिर से प्रयास करें।
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: spacing.lg, minHeight: 48, justifyContent: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="वापस जाएं"
          >
            <Text style={{ color: '#fff', fontSize: 16 }}>वापस जाएं</Text>
          </TouchableOpacity>
        </View>
      )}

      {perm === 'granted' && (
        <WebView
          source={{ uri }}
          onMessage={onMessage}
          style={{ flex: 1, backgroundColor: '#000' }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          // iOS: grant camera to the page without a second prompt.
          // (Android grants via WebChromeClient.onPermissionRequest once the
          //  app holds CAMERA, handled by react-native-webview.)
          mediaCapturePermissionGrantType="grant"
          originWhitelist={['*']}
        />
      )}
    </View>
  );
}
