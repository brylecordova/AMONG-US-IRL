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

const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  selection: 10,
  light: 16,
  medium: 28,
  heavy: 45,
  success: [18, 45, 32],
  warning: [35, 55, 35],
  error: [45, 45, 45, 45, 65],
  alarm: [140, 80, 140, 80, 180],
  killed: [220, 90, 320],
  sabotage: [160, 85, 160],
};

class HapticsEngine {
  private enabled = true;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignore browser vibration cancellation errors
      }
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    if (typeof window.AmongUsAndroid?.triggerHaptic === 'function') return true;
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  public trigger(kind: HapticKind): void {
    if (!this.enabled || typeof window === 'undefined') return;

    try {
      if (typeof window.AmongUsAndroid?.triggerHaptic === 'function') {
        window.AmongUsAndroid.triggerHaptic(kind);
        return;
      }

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(HAPTIC_PATTERNS[kind]);
      }
    } catch {
      // Ignore blocked vibration calls prior to user gesture or unsupported environments
    }
  }

  public selection(): void {
    this.trigger('selection');
  }

  public impact(style: 'light' | 'medium' | 'heavy' = 'medium'): void {
    this.trigger(style);
  }

  public notify(type: 'success' | 'warning' | 'error'): void {
    this.trigger(type);
  }

  public event(type: 'alarm' | 'killed' | 'sabotage'): void {
    this.trigger(type);
  }
}

export const haptics = new HapticsEngine();
