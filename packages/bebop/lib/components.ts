import type { IEntity } from './bebop';

export const componentIds: Record<keyof IEntity, number> = {
  id: 1,
  parent: 2,
  children: 3,
  tags: 4,
  position: 5,
  sprite: 6,
  mana: 7,
  name: 8,
  ticking: 9,
  player: 10,
  geometry: 11,
};

export const componentNames: Record<number, keyof IEntity> = {
  1: 'id',
  2: 'parent',
  3: 'children',
  4: 'tags',
  5: 'position',
  6: 'sprite',
  7: 'mana',
  8: 'name',
  9: 'ticking',
  10: 'player',
  11: 'geometry',
};
