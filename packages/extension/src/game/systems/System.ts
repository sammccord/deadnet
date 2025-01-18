import type { IEntity } from '@deadnet/bebop/lib/bebop';
import type { ECS } from '@deadnet/ecs/lib/ECS';
import type { Query, QueryBuilder } from '@deadnet/ecs/lib/Query';

export type SimpleSystem<Params> = (
  ecs: ECS<IEntity, [number]>,
  params: Params,
) => void | (() => void);

export type SystemConstructor<Params> = new (
  ecs: ECS<IEntity, [number]>,
  params: Params,
) => System<Params>;

export class System<Params> {
  public query: Query | ((buildQuery: QueryBuilder) => QueryBuilder) = (q) => q;
  ecs: ECS<IEntity, [number]>;
  params: Params;
  constructor(ecs: ECS<IEntity, [number]>, params: Params) {
    this.ecs = ecs;
    this.params = params;
  }
  public update(
    _entities: number[],
    _ecs: ECS<IEntity, [number]>,
    _delta: number,
  ): void {
    void 0;
  }
  public destroy() {
    void 0;
  }
}
