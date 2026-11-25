import { Platform, Vibration } from 'react-native';

export type HapticKind =
  | 'selection'
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'alarm'
  | 'killed'
  | 'sabotage';

const ANDROID_PATTERNS: Record<HapticKind, number[]> = {
  selection: [0, 12],
  light: [0, 18],
  medium: [0, 28],
  heavy: [0, 45],
  success: [0, 20, 45, 35],
  warning: [0, 35, 55, 35],
  error: [0, 45, 45, 45, 45, 65],
  alarm: [0, 220, 120, 220],
  killed: [0, 300, 120, 400],
  sabotage: [0, 250, 100, 250],
};

export const haptics = {
  trigger(kind: HapticKind): void {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(ANDROID_PATTERNS[kind].slice(1));
        }
        return;
      }

      if (Platform.OS === 'ios') {
        // React Native Vibration on iOS only supports default/pattern triggers without durations
        if (kind === 'alarm' || kind === 'killed' || kind === 'sabotage' || kind === 'error') {
          Vibration.vibrate([0, 300]);
        } else {
          Vibration.vibrate();
        }
        return;
      }

      const pattern = ANDROID_PATTERNS[kind];
      if (pattern.length === 2) {
        Vibration.vibrate(pattern[1]);
      } else {
        Vibration.vibrate(pattern);
      }
    } catch {
      // Ignore unavailable vibration hardware errors
    }
  },
  selection(): void {
    this.trigger('selection');
  },
  impact(style: 'light' | 'medium' | 'heavy' = 'medium'): void {
    this.trigger(style);
  },
  notify(type: 'success' | 'warning' | 'error'): void {
    this.trigger(type);
  },
  event(type: 'alarm' | 'killed' | 'sabotage'): void {
    this.trigger(type);
  },
};
