import React from 'react';
import { SvgProps } from 'react-native-svg';
import Svg, { Path, Circle, Rect, Line, G } from 'react-native-svg';
import { colors } from '../styles/colors';

interface IconProps extends SvgProps {
  name:
    | 'home'
    | 'recipes'
    | 'planner'
    | 'shopping'
    | 'favorites'
    | 'profile'
    | 'cooking-time'
    | 'difficulty'
    | 'ingredients'
    | 'settings'
    | 'import-recipe'
    | 'ai-recommendation'
    | 'family-members'
    | 'cooking-steps'
    | 'share-recipe'
    | 'main-account'
    | 'other-users'
    | 'helper'
    | 'ai-dinner'
    | 'ai-assistant'
    | 'pantry'
    | 'price-comparison';
  size?: number;
  color?: string;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = colors.primary.navy,
  ...props
}) => {
  const iconProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'home':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Path d="M9 22v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
        </Svg>
      );

    case 'recipes':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <Path d="M9 7h6M9 11h6" />
        </Svg>
      );

    case 'planner':
      return (
        <Svg {...iconProps} {...props}>
          <Rect x="3" y="4" width="18" height="18" rx="2" />
          <Path d="M16 2v4M8 2v4M3 10h18" />
          <Rect x="5" y="12" width="2" height="2" />
          <Rect x="11" y="12" width="2" height="2" />
          <Rect x="17" y="12" width="2" height="2" />
          <Rect x="5" y="18" width="2" height="2" />
          <Rect x="11" y="18" width="2" height="2" />
          <Rect x="17" y="18" width="2" height="2" />
        </Svg>
      );

    case 'shopping':
      return (
        <Svg {...iconProps} {...props}>
          <Circle cx="9" cy="21" r="1" />
          <Circle cx="20" cy="21" r="1" />
          <Path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </Svg>
      );

    case 'favorites':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </Svg>
      );

    case 'profile':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <Circle cx="12" cy="7" r="4" />
        </Svg>
      );

    case 'cooking-time':
      return (
        <Svg {...iconProps} {...props}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 6v6l4 2" />
        </Svg>
      );

    case 'difficulty':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </Svg>
      );

    case 'ingredients':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
          <Path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
        </Svg>
      );

    case 'settings':
      return (
        <Svg {...iconProps} {...props}>
          <Circle cx="12" cy="12" r="3" />
          <Path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m3.08 3.08l4.24 4.24M1 12h6m6 0h6m-16.78 7.78l4.24-4.24m3.08-3.08l4.24-4.24" />
        </Svg>
      );

    case 'import-recipe':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <Path d="M7 10l5 5 5-5M12 15V3" />
        </Svg>
      );

    case 'ai-recommendation':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M12 2l3 7h7l-5.5 4 2 7-6.5-5-6.5 5 2-7-5.5-4h7z" />
          <Path d="M12 11v6M8 14h8" />
        </Svg>
      );

    case 'family-members':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <Circle cx="9" cy="7" r="4" />
          <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </Svg>
      );

    case 'cooking-steps':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M9 11l3 3L22 4" />
          <Path d="M20 12v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </Svg>
      );

    case 'share-recipe':
      return (
        <Svg {...iconProps} {...props}>
          <Circle cx="18" cy="5" r="3" />
          <Circle cx="6" cy="12" r="3" />
          <Circle cx="18" cy="19" r="3" />
          <Path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
        </Svg>
      );

    case 'main-account':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <Circle cx="12" cy="7" r="4" />
          <Path d="M16 11h6" />
        </Svg>
      );

    case 'other-users':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <Circle cx="9" cy="7" r="4" />
          <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </Svg>
      );

    case 'helper':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <Circle cx="12" cy="7" r="4" />
          <Path d="M12 12v6M9 15h6" />
        </Svg>
      );

    case 'ai-dinner':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M12 2l3 7h7l-5.5 4 2 7-6.5-5-6.5 5 2-7-5.5-4h7z" fill={color} />
        </Svg>
      );

    case 'ai-assistant':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M12 2l3 7h7l-5.5 4 2 7-6.5-5-6.5 5 2-7-5.5-4h7z" />
          <Circle cx="12" cy="12" r="2" />
        </Svg>
      );

    case 'pantry':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M9 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2m0 0V2a2 2 0 1 0-4 0v0" />
          <Rect x="6" y="8" width="12" height="2" />
          <Rect x="6" y="14" width="12" height="2" />
        </Svg>
      );

    case 'price-comparison':
      return (
        <Svg {...iconProps} {...props}>
          <Path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z" />
          <Path d="M12 6v6l4 2" />
        </Svg>
      );

    default:
      return null;
  }
};

export default function IconRoute() { return null; }
