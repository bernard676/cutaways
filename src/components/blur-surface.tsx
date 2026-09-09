import { BlurView } from 'expo-blur';
import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useColorScheme, useTheme } from '@/hooks/use-theme';
import { useReduceTransparency } from '@/hooks/use-reduce-transparency';

interface BlurSurfaceProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  /** Draw the bright hairline that reads as light catching the top edge of the material. */
  topBorder?: boolean;
}

/**
 * A translucent floating layer — nav/toolbars/pills that content scrolls under, rather than
 * an opaque strip that consumes a fixed band (apple-design §12). Falls back to a solid
 * surface when the OS "Reduce Transparency" setting is on.
 */
export function BlurSurface({ style, intensity = 40, topBorder = false, children }: BlurSurfaceProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const reduceTransparency = useReduceTransparency();

  if (reduceTransparency) {
    return (
      <View
        style={[
          { backgroundColor: theme.background },
          topBorder && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
          style,
        ]}>
        {children}
      </View>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint={scheme === 'dark' ? 'dark' : 'light'}
      style={[
        { backgroundColor: scheme === 'dark' ? 'rgba(17,24,39,0.55)' : 'rgba(255,255,255,0.6)' },
        topBorder && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)',
        },
        style,
      ]}>
      {children}
    </BlurView>
  );
}
