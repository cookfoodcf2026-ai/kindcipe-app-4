import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors } from '@/app/styles/colors';

interface IconBaseProps {
  size?: number;
  color?: string;
  focused?: boolean;
}

interface IconRegistry {
  [key: string]: React.FC<IconBaseProps>;
}

const createIcon = (paths: React.ReactNode, viewBox = '0 0 24 24'): React.FC<IconBaseProps> => {
  const IconComponent: React.FC<IconBaseProps> = ({ size = 24, color = colors.primary.navy }) => (
    <Svg width={size} height={size} viewBox={viewBox} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {paths}
    </Svg>
  );
  IconComponent.displayName = 'SvgIcon';
  return IconComponent;
};

export const HomeIcon = createIcon(
  <>
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Path d="M9 22v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
  </>
);

export const RecipeIcon = createIcon(
  <>
    <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <Path d="M9 7h6M9 11h6" />
  </>
);

export const PlannerIcon = createIcon(
  <>
    <Rect x="3" y="4" width="18" height="18" rx="2" />
    <Path d="M16 2v4M8 2v4M3 10h18" />
    <Rect x="5" y="12" width="2" height="2" />
    <Rect x="11" y="12" width="2" height="2" />
    <Rect x="17" y="12" width="2" height="2" />
    <Rect x="5" y="18" width="2" height="2" />
    <Rect x="11" y="18" width="2" height="2" />
    <Rect x="17" y="18" width="2" height="2" />
  </>
);

export const ShoppingIcon = createIcon(
  <>
    <Circle cx="9" cy="21" r="1" />
    <Circle cx="20" cy="21" r="1" />
    <Path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </>
);

export const BookmarkIcon = createIcon(
  <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
);

export const ProfileIcon = createIcon(
  <>
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <Circle cx="12" cy="7" r="4" />
  </>
);

export const CookingTimeIcon = createIcon(
  <>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 6v6l4 2" />
  </>
);

export const DifficultyIcon = createIcon(
  <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
);

export const IngredientsIcon = createIcon(
  <>
    <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    <Path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
  </>
);

export const SettingsIcon = createIcon(
  <>
    <Circle cx="12" cy="12" r="3" />
    <Path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m3.08 3.08l4.24 4.24M1 12h6m6 0h6m-16.78 7.78l4.24-4.24m3.08-3.08l4.24-4.24" />
  </>
);

export const ImportIcon = createIcon(
  <>
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Path d="M7 10l5 5 5-5M12 15V3" />
  </>
);

export const AiIcon = createIcon(
  <>
    <Path d="M12 2l3 7h7l-5.5 4 2 7-6.5-5-6.5 5 2-7-5.5-4h7z" />
    <Circle cx="12" cy="12" r="2" />
  </>
);

export const FamilyIcon = createIcon(
  <>
    <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <Circle cx="9" cy="7" r="4" />
    <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>
);

export const CookingStepsIcon = createIcon(
  <>
    <Path d="M9 11l3 3L22 4" />
    <Path d="M20 12v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </>
);

export const ShareIcon = createIcon(
  <>
    <Circle cx="18" cy="5" r="3" />
    <Circle cx="6" cy="12" r="3" />
    <Circle cx="18" cy="19" r="3" />
    <Path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
  </>
);

export const MainAccountIcon = createIcon(
  <>
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <Circle cx="12" cy="7" r="4" />
    <Path d="M16 11h6" />
  </>
);

export const OtherUsersIcon = createIcon(
  <>
    <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <Circle cx="9" cy="7" r="4" />
    <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>
);

export const HelperIcon = createIcon(
  <>
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <Circle cx="12" cy="7" r="4" />
    <Path d="M12 12v6M9 15h6" />
  </>
);

export const AiDinnerIcon = createIcon(
  <Path d="M12 2l3 7h7l-5.5 4 2 7-6.5-5-6.5 5 2-7-5.5-4h7z" />
);

export const PantryIcon = createIcon(
  <>
    <Path d="M9 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2m0 0V2a2 2 0 1 0-4 0v0" />
    <Rect x="6" y="8" width="12" height="2" />
    <Rect x="6" y="14" width="12" height="2" />
  </>
);

export const PriceComparisonIcon = createIcon(
  <>
    <Path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z" />
    <Path d="M12 6v6l4 2" />
  </>
);

export const ChefHatIcon = createIcon(
  <>
    <Path d="M6 13.87A4 4 0 0 1 7.5 6.5a5 5 0 0 1 9 0A4 4 0 0 1 18 13.87" />
    <Path d="M6 17h12" />
    <Path d="M6 13.87V19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5.13" />
  </>
);

export const GridIcon = createIcon(
  <>
    <Rect x="3" y="3" width="7" height="7" />
    <Rect x="14" y="3" width="7" height="7" />
    <Rect x="14" y="14" width="7" height="7" />
    <Rect x="3" y="14" width="7" height="7" />
  </>
);

export const ShoppingListIcon = createIcon(
  <>
    <Path d="M9 11l3 3L22 4" />
    <Path d="M20 12v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </>
);

export const SearchIcon = createIcon(
  <>
    <Circle cx="11" cy="11" r="8" />
    <Path d="M21 21l-4.35-4.35" />
  </>
);

export const StarIcon = createIcon(
  <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
);

export const CheckIcon = createIcon(
  <Path d="M20 6L9 17l-5-5" />
);

export const XIcon = createIcon(
  <>
    <Path d="M18 6L6 18M6 6l12 12" />
  </>
);

export const ClockIcon = createIcon(
  <>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 6v6l4 2" />
  </>
);

export const SunriseIcon = createIcon(
  <>
    <Path d="M17 18a5 5 0 0 0-10 0" />
    <Path d="M12 2v7M4.22 10.22l1.42 1.42M1 18h22M16 18h-8" />
    <Path d="M18.36 11.64l1.42-1.42" />
  </>
);

export const SunIcon = createIcon(
  <>
    <Circle cx="12" cy="12" r="5" />
    <Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </>
);

export const MoonIcon = createIcon(
  <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
);

const iconRegistry: IconRegistry = {
  home: HomeIcon,
  recipes: RecipeIcon,
  planner: PlannerIcon,
  shopping: ShoppingIcon,
  favorites: BookmarkIcon,
  profile: ProfileIcon,
  'cooking-time': CookingTimeIcon,
  difficulty: DifficultyIcon,
  ingredients: IngredientsIcon,
  settings: SettingsIcon,
  'import-recipe': ImportIcon,
  'ai-recommendation': AiIcon,
  'family-members': FamilyIcon,
  'cooking-steps': CookingStepsIcon,
  'share-recipe': ShareIcon,
  'main-account': MainAccountIcon,
  'other-users': OtherUsersIcon,
  helper: HelperIcon,
  'ai-dinner': AiDinnerIcon,
  'ai-assistant': AiIcon,
  pantry: PantryIcon,
  'price-comparison': PriceComparisonIcon,
  grid: GridIcon,
  'shopping-list': ShoppingListIcon,
  'chef-hat': ChefHatIcon,
  search: SearchIcon,
  star: StarIcon,
  check: CheckIcon,
  x: XIcon,
  clock: ClockIcon,
  sunrise: SunriseIcon,
  sun: SunIcon,
  moon: MoonIcon,
};

interface IconProps {
  name: keyof typeof iconRegistry;
  size?: number;
  color?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size, color }) => {
  const IconComponent = iconRegistry[name];
  if (!IconComponent) return null;
  return <IconComponent size={size} color={color} />;
};

export default iconRegistry;
