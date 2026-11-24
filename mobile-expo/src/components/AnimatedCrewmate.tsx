import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { getColorDef, PlayerColorId } from '../skeldShared';

interface AnimatedCrewmateProps {
  color: PlayerColorId;
  alive?: boolean;
  size?: number;
  animate?: boolean;
}

export const AnimatedCrewmate: React.FC<AnimatedCrewmateProps> = ({
  color,
  alive = true,
  size = 48,
  animate = false,
}) => {
  const def = getColorDef(color);
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      floatAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, floatAnim]);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  if (!alive) {
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Rect
          x="18"
          y="30"
          width="28"
          height="24"
          rx="8"
          fill={def.hex}
          stroke="#090D16"
          strokeWidth="3.5"
        />
        <Rect
          x="10"
          y="33"
          width="10"
          height="16"
          rx="4"
          fill={def.shade}
          stroke="#090D16"
          strokeWidth="3"
        />
        <Ellipse cx="32" cy="30" rx="14" ry="5" fill="#7F1D1D" stroke="#090D16" strokeWidth="2.5" />
        <Rect x="29" y="16" width="6" height="15" rx="2" fill="#F1F5F9" stroke="#090D16" strokeWidth="2.5" />
        <Ellipse cx="29" cy="16" rx="4" ry="3.5" fill="#F1F5F9" stroke="#090D16" strokeWidth="2" />
        <Ellipse cx="35" cy="16" rx="4" ry="3.5" fill="#F1F5F9" stroke="#090D16" strokeWidth="2" />
      </Svg>
    );
  }

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Rect
          x="8"
          y="22"
          width="12"
          height="24"
          rx="6"
          fill={def.shade}
          stroke="#090D16"
          strokeWidth="3.5"
        />
        <Path
          d="M18 22 C18 10, 48 10, 48 22 L48 47 C48 53, 44 55, 40 55 C36 55, 35 51, 35 46 L29 46 C29 51, 28 55, 24 55 C20 55, 18 53, 18 47 Z"
          fill={def.hex}
          stroke="#090D16"
          strokeWidth="3.5"
        />
        <Rect
          x="26"
          y="18"
          width="24"
          height="14"
          rx="7"
          fill="#93C5FD"
          stroke="#090D16"
          strokeWidth="3"
        />
        <Rect x="32" y="21" width="12" height="4" rx="2" fill="#E0F2FE" />
      </Svg>
    </Animated.View>
  );
};
