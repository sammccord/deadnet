import type { Archetype } from './Archetype'
import type { ECS } from './ECS'
import { type QueryBuilder, type Query, query as buildQuery } from './Query'

export type BaseSystem = {
  readonly query: Query
}

export type EntitySystem<TUpdateArguments extends any[] = never> = BaseSystem & {
  /**
   * 0 = entitySystem
   * 1 = archetypeSystem
   */
  readonly type: 0
  execute(entities: Array<number>, world: ECS<TUpdateArguments>, ...args: TUpdateArguments): void
}

export type ArchetypeSystem<TUpdateArguments extends any[] = never> = BaseSystem & {
  /**
   * 0 = entitySystem
   * 1 = archetypeSystem
   */
  readonly type: 1
  execute(archetypes: Set<Archetype>, world: ECS<TUpdateArguments>, ...args: TUpdateArguments): void
}

export type EventSystem = BaseSystem & {
  /**
   * 0 = entitySystem
   * 1 = archetypeSystem
   */
  readonly type: 2
  execute(entities: Array<number>): void
}

export type LifecycleSystem = BaseSystem & {
  /**
   * 0 = entitySystem
   * 1 = archetypeSystem
   */
  readonly type: 3
  execute(entity: number): void
}

export type System<TUpdateArguments extends any[] = never> =
  | EntitySystem<TUpdateArguments>
  | ArchetypeSystem<TUpdateArguments>
  | EventSystem
  | LifecycleSystem

/**
 * An entity system is a system that will be executed for each archetype matching the query.
 * In other words, it may be executed multiple times in each update.
 * If you need the system to only execute once in each update, use the `ArchetypeSystem` created by `createArchetypeSystem`
 * @param execute
 * @param query
 * @returns
 */
export function createEntitySystem<TUpdateArguments extends any[] = never>(
  execute: (
    entities: Array<number>,
    world: ECS<TUpdateArguments>,
    ...args: TUpdateArguments
  ) => void,
  query: Query | ((buildQuery: QueryBuilder) => QueryBuilder)
): EntitySystem<TUpdateArguments> {
  query = typeof query === 'function' ? buildQuery(query) : query
  return Object.freeze({
    execute,
    query,
    type: 0
  })
}

/**
 * An archetype system is a system that that will only execute once in each update with all the archetypes matching the query.
 * This is usefull when your query potentially matches 2 or more archetypes and you need to check for the presence of a componentId on entities.
 * The differing components can be checked for once for each archetype instead of for each entity.
 * @param execute
 * @param queryParams
 * @returns
 */
export function createArchetypeSystem<TUpdateArguments extends any[] = never>(
  execute: (
    archetypes: Set<Archetype>,
    world: ECS<TUpdateArguments>,
    ...args: TUpdateArguments
  ) => void,
  query: Query | ((buildQuery: QueryBuilder) => QueryBuilder)
): ArchetypeSystem<TUpdateArguments> {
  query = typeof query === 'function' ? buildQuery(query) : query
  return Object.freeze({
    execute,
    query,
    type: 1
  })
}

/**
 * An archetype system is a system that that will only execute once in each update with all the archetypes matching the query.
 * This is usefull when your query potentially matches 2 or more archetypes and you need to check for the presence of a componentId on entities.
 * The differing components can be checked for once for each archetype instead of for each entity.
 * @param execute
 * @param queryParams
 * @returns
 */
export function createEventSystem(
  execute: (entities: Array<number>) => void,
  query: Query | ((buildQuery: QueryBuilder) => QueryBuilder)
): EventSystem {
  query = typeof query === 'function' ? buildQuery(query) : query
  return Object.freeze({
    execute,
    query,
    type: 2
  })
}

export function createLifecycleSystem(
  execute: (entity: number) => void,
  query: Query | ((buildQuery: QueryBuilder) => QueryBuilder)
): LifecycleSystem {
  query = typeof query === 'function' ? buildQuery(query) : query
  return Object.freeze({
    execute,
    query,
    type: 3
  })
}
