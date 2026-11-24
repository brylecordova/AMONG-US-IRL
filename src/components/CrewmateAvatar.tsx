import React from 'react';
import { motion } from 'motion/react';
import { getColorDef, PlayerColorId } from '../shared/skeldData';

interface CrewmateAvatarProps {
  color: PlayerColorId;
  alive?: boolean;
  ghost?: boolean;
  size?: number;
  className?: string;
  animate?: boolean;
}

export const CrewmateAvatar: React.FC<CrewmateAvatarProps> = ({
  color,
  alive = true,
  ghost = false,
  size = 44,
  className = '',
  animate = false,
}) => {
  const c = getColorDef(color);

  if (!alive && !ghost) {
    // Dead Crewmate half-body with protruding bone SVG
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        className={className}
        aria-label={`${c.label} eliminated crewmate`}
      >
        {/* Bone */}
        <path
          d="M32 14C28 14 26 17 28 20L28 31H36V20C38 17 36 14 32 14Z"
          fill="#E2E8F0"
          stroke="#0F172A"
          strokeWidth="3"
        />
        <circle cx="29" cy="15" r="4" fill="#E2E8F0" stroke="#0F172A" strokeWidth="2.5" />
        <circle cx="35" cy="15" r="4" fill="#E2E8F0" stroke="#0F172A" strokeWidth="2.5" />
        {/* Lower Suit */}
        <path
          d="M17 33C17 29 47 29 47 33V48C47 52 43 54 39 54C36 54 35 50 35 46H29C29 50 28 54 25 54C21 54 17 52 17 48V33Z"
          fill={c.hex}
          stroke="#0F172A"
          strokeWidth="3"
        />
        {/* Cut Flesh Ring */}
        <ellipse cx="32" cy="32" rx="15" ry="5" fill="#991B1B" stroke="#0F172A" strokeWidth="2.5" />
        {/* Backpack */}
        <rect x="11" y="34" width="7" height="14" rx="3" fill={c.shade} stroke="#0F172A" strokeWidth="2.5" />
      </svg>
    );
  }

  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={`${ghost ? 'opacity-55' : ''} ${animate ? '' : className}`}
      aria-label={`${c.label} crewmate`}
    >
      {/* Backpack */}
      <rect
        x="10"
        y="22"
        width="10"
        height="24"
        rx="4"
        fill={c.shade}
        stroke="#0F172A"
        strokeWidth="3"
      />
      {/* Body */}
      {ghost ? (
        <path
          d="M18 24C18 14 25 9 33 9C42 9 49 15 49 25V49C46 53 42 48 39 52C36 55 32 49 28 52C24 55 20 50 18 48V24Z"
          fill={c.hex}
          stroke="#0F172A"
          strokeWidth="3"
        />
      ) : (
        <path
          d="M18 24C18 14 25 9 33 9C42 9 49 15 49 25V49C49 53 45 55 41 55C37 55 36 51 36 46H29C29 51 28 55 24 55C20 55 18 52 18 48V24Z"
          fill={c.hex}
          stroke="#0F172A"
          strokeWidth="3"
        />
      )}
      {/* Visor */}
      <rect
        x="27"
        y="17"
        width="23"
        height="13"
        rx="6.5"
        fill="#7DD3FC"
        stroke="#0F172A"
        strokeWidth="3"
      />
      <rect x="33" y="19.5" width="12" height="4" rx="2" fill="#E0F2FE" />
    </svg>
  );

  if (!animate) {
    return svg;
  }

  return (
    <motion.div
      animate={ghost ? { y: [0, -5, 0], opacity: [0.55, 0.75, 0.55] } : { y: [0, -3.5, 0] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      className={`inline-flex shrink-0 ${className}`}
    >
      {svg}
    </motion.div>
  );
};
