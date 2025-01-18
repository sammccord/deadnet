import type { IEntity } from '@deadnet/bebop/lib/bebop';

export const terrain = {
  [1]: {
    id: 1,
    name: 'Floor',
    sprite: 'floor.png',
    difficulty: 1,
  },
};

export const pawns: Record<string, IEntity> = {
  kitsune: {
    ticking: false,
    sprite: {
      texture: 'kitsune.png',
    },
    mana: {
      points: 3,
      min: 0,
      max: 255,
      rate: 1,
      intervalMs: 1000,
    },
  },
  ram: {
    ticking: false,
    mana: {
      points: 5,
      min: 0,
      max: 5,
      rate: 0,
      intervalMs: 0,
    },
  },
} as const;
