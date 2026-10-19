export interface PowerUp {
  id: string;
  name: string;
  description: string;
  icon: string;
  duration?: number;
  effect: PowerUpEffect;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface PowerUpEffect {
  type: 'time_freeze' | 'path_hint' | 'undo_protection' | 'score_multiplier';
  value?: number;
  duration?: number;
}

export const powerUps: PowerUp[] = [
  {
    id: 'time_freeze',
    name: 'Time Freeze',
    description: 'Pause the level timer for 30 seconds',
    icon: '⏰',
    duration: 30000,
    effect: {
      type: 'time_freeze',
      duration: 30000
    },
    rarity: 'rare'
  },
  {
    id: 'path_hint',
    name: 'Path Reveal',
    description: 'Reveal the full path for 5 seconds',
    icon: '💡',
    duration: 5000,
    effect: {
      type: 'path_hint',
      duration: 5000
    },
    rarity: 'common'
  },
  {
    id: 'undo_protection',
    name: 'Undo Shield',
    description: 'Your next backtrack won\'t cost a star, but still uses one of the three backtracks',
    icon: '🛡️',
    effect: {
      type: 'undo_protection',
      value: 1
    },
    rarity: 'epic'
  },
  {
    id: 'score_multiplier',
    name: 'Score Boost',
    description: '2x score for next 3 levels',
    icon: '⭐',
    duration: 0, // Persistent until used up
    effect: {
      type: 'score_multiplier',
      value: 2,
      duration: 3 // levels
    },
    rarity: 'legendary'
  }
];

export const getPowerUp = (powerUpId: string): PowerUp | undefined => {
  return powerUps.find(pu => pu.id === powerUpId);
};

export const getRarityColor = (rarity: PowerUp['rarity']) => {
  switch (rarity) {
    case 'common': return '#94a3b8';
    case 'rare': return '#3b82f6';
    case 'epic': return '#a855f7';
    case 'legendary': return '#f59e0b';
    default: return '#94a3b8';
  }
};
