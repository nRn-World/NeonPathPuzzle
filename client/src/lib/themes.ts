import { isSeasonRewardEarned } from './seasons';

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    neon: string[];
  };
  effects: {
    glow: string;
    particle: string;
  };
  /** Levels that must be completed before the theme can be selected. */
  unlockAtLevels: number;
  /** Seasonal themes are earned by finishing that event, not by clearing levels. */
  seasonId?: string;
}

export const themes: Theme[] = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Classic neon blue and violet',
    colors: {
      primary: '#00f3ff',
      secondary: '#8a2be2',
      accent: '#ffffff',
      background: '#0a0a0a',
      neon: ['#00f3ff', '#8a2be2', '#ffffff']
    },
    effects: {
      glow: '0 0 20px rgba(0, 243, 255, 0.5)',
      particle: 'cyan'
    },
    unlockAtLevels: 0
  },
  {
    id: 'retro',
    name: 'Retro Wave',
    description: '80s-inspired pink and cyan',
    colors: {
      primary: '#ff6ec7',
      secondary: '#00ffff',
      accent: '#ffff00',
      background: '#1a0033',
      neon: ['#ff6ec7', '#00ffff', '#ffff00']
    },
    effects: {
      glow: '0 0 25px rgba(255, 110, 199, 0.6)',
      particle: 'pink'
    },
    unlockAtLevels: 10
  },
  {
    id: 'cosmic',
    name: 'Cosmic',
    description: 'Deep space blue with gold',
    colors: {
      primary: '#4a90e2',
      secondary: '#ffd700',
      accent: '#ff69b4',
      background: '#000814',
      neon: ['#4a90e2', '#ffd700', '#ff69b4']
    },
    effects: {
      glow: '0 0 30px rgba(74, 144, 226, 0.7)',
      particle: 'gold'
    },
    unlockAtLevels: 50
  },
  {
    id: 'matrix',
    name: 'Matrix',
    description: 'Green digital rain',
    colors: {
      primary: '#00ff41',
      secondary: '#008f11',
      accent: '#ffffff',
      background: '#000000',
      neon: ['#00ff41', '#008f11', '#ffffff']
    },
    effects: {
      glow: '0 0 15px rgba(0, 255, 65, 0.8)',
      particle: 'lime'
    },
    unlockAtLevels: 100
  },
  {
    id: 'sunset',
    name: 'Neon Sunset',
    description: 'Warm orange and violet sunset',
    colors: {
      primary: '#ff6b35',
      secondary: '#c77dff',
      accent: '#ffbe0b',
      background: '#0d0015',
      neon: ['#ff6b35', '#c77dff', '#ffbe0b']
    },
    effects: {
      glow: '0 0 25px rgba(255, 107, 53, 0.6)',
      particle: 'orange'
    },
    unlockAtLevels: 200
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Polar green, violet and coral light',
    colors: {
      primary: '#00e5a0',
      secondary: '#7b8cff',
      accent: '#ff6b8b',
      background: '#020b10',
      neon: ['#00e5a0', '#7b8cff', '#ff6b8b']
    },
    effects: {
      glow: '0 0 28px rgba(0, 229, 160, 0.6)',
      particle: 'aqua'
    },
    unlockAtLevels: 250
  },
  {
    id: 'bloom',
    name: 'Spring Bloom',
    description: 'Blossom pink, mint and sunlight',
    colors: {
      primary: '#ff9ecb',
      secondary: '#7dffb2',
      accent: '#fff27d',
      background: '#0b0a14',
      neon: ['#ff9ecb', '#7dffb2', '#fff27d']
    },
    effects: { glow: '0 0 26px rgba(255, 158, 203, 0.6)', particle: 'pink' },
    unlockAtLevels: 0,
    seasonId: 'spring'
  },
  {
    id: 'solar',
    name: 'Solar Flare',
    description: 'Hot amber, magenta and cyan',
    colors: {
      primary: '#ffb300',
      secondary: '#ff3d71',
      accent: '#00e5ff',
      background: '#120800',
      neon: ['#ffb300', '#ff3d71', '#00e5ff']
    },
    effects: { glow: '0 0 28px rgba(255, 179, 0, 0.65)', particle: 'gold' },
    unlockAtLevels: 0,
    seasonId: 'summer'
  },
  {
    id: 'haunted',
    name: 'Haunted Grid',
    description: 'Pumpkin orange, violet and acid green',
    colors: {
      primary: '#ff7a00',
      secondary: '#7a1fff',
      accent: '#b6ff00',
      background: '#0a0010',
      neon: ['#ff7a00', '#7a1fff', '#b6ff00']
    },
    effects: { glow: '0 0 28px rgba(255, 122, 0, 0.65)', particle: 'orange' },
    unlockAtLevels: 0,
    seasonId: 'halloween'
  },
  {
    id: 'frost',
    name: 'Frostbyte',
    description: 'Ice blue, lavender and white',
    colors: {
      primary: '#8fe8ff',
      secondary: '#b9a7ff',
      accent: '#ffffff',
      background: '#02101a',
      neon: ['#8fe8ff', '#b9a7ff', '#ffffff']
    },
    effects: { glow: '0 0 26px rgba(143, 232, 255, 0.6)', particle: 'aqua' },
    unlockAtLevels: 0,
    seasonId: 'winter'
  }
];

export const isThemeUnlocked = (themeId: string, completedLevels: number): boolean => {
  const theme = getTheme(themeId);
  if (theme.seasonId) return isSeasonRewardEarned(theme.seasonId);
  return completedLevels >= theme.unlockAtLevels;
};

export const getTheme = (themeId: string): Theme => {
  return themes.find(theme => theme.id === themeId) || themes[0];
};
