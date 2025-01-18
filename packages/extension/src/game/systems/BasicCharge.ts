import type {
  IBasicChargeParams,
  IEntity,
  IPool,
} from '@deadnet/bebop/lib/bebop';
import { componentIds, componentNames } from '@deadnet/bebop/lib/components';
import type { ECS } from '@deadnet/ecs/lib/ECS';
import type { Query, QueryBuilder } from '@deadnet/ecs/lib/Query';
import { Timer } from '../ticker/Timer';
import { clampUint32 } from '../utils';
import { System } from './System';

export class BasicCharge extends System<IBasicChargeParams> {
  query: Query | ((buildQuery: QueryBuilder) => QueryBuilder);
  timer = new Timer((e) => e.mana!.intervalMs);
  component: keyof IEntity;

  constructor(ecs: ECS<IEntity, [number]>, params: IBasicChargeParams) {
    super(ecs, params);
    this.component = (componentNames[params.pool] as keyof IEntity) || 'mana';
    this.query = (q) =>
      q.prefabricated(
        ecs.prefabricate([
          params.pool || componentIds['mana'],
          componentIds.ticking,
          ...params.query,
        ]),
      );
  }

  update(entities: number[], ecs: ECS<IEntity, [number]>, delta: number) {
    for (let i = 0; i < entities.length; i++) {
      const id = entities[i]!;
      const entity = ecs.entity(id);
      const pool = entity[this.component] as IPool;
      // if the entity isn't ticking, or at its full capacity
      if (!entity.ticking || pool.points >= pool.max) {
        this.timer.remove(entity);
        continue;
      }
      // how much should the pool increment?
      const value = this.timer.update(entity, delta);
      if (!value) continue;
      ecs.put({
        id,
        [this.component]: {
          min: pool.min,
          max: pool.max,
          rate: pool.rate,
          intervalMs: pool.intervalMs,
          points: clampUint32(
            pool.points + value * pool.rate,
            pool.min,
            pool.max,
          ),
        },
      });
    }
  }
}
