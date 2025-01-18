import { EntityCapacity, type IEntity } from '@deadnet/bebop/lib/bebop';
import { componentIds } from '@deadnet/bebop/lib/components';
import { ECS as _ECS } from '@deadnet/ecs/lib/ECS';
import {
  type Query,
  type QueryBuilder,
  createBuilder,
  createEventSystem,
} from '@deadnet/ecs/lib/index';
import {
  type ContextProviderProps,
  createContextProvider,
} from '@solid-primitives/context';
import { makePersisted } from '@solid-primitives/storage';
import { type Accessor, batch, from } from 'solid-js';
import { createStore } from 'solid-js/store';
import { useGameState } from './GameStateContext';
import { wrapContext } from './utils';

class ECS extends _ECS<IEntity, [number]> {
  public insert(entity: IEntity): IEntity {
    return batch(() => {
      return super.insert(entity);
    });
  }

  public put(patch: IEntity, mutating = false): IEntity {
    return batch(() => {
      return super.put(patch, mutating);
    });
  }

  public delete(entity: IEntity): IEntity | undefined {
    return batch(() => {
      return super.delete(entity);
    });
  }
}

const [ECSProvider, _useECS] = createContextProvider<ECS, ContextProviderProps>(
  () => {
    const [entities, mutateEntities] = makePersisted(
      createStore<Array<IEntity>>(
        Array.from({ length: EntityCapacity }, () => ({}) as IEntity),
      ),
      { name: 'ecs' },
    );
    const ecs = new ECS(entities, mutateEntities, {
      exists: (e) => e.id !== undefined,
      components: componentIds,
    });
    for (const entity of ecs.entities) {
      ecs.insert(entity);
    }
    return ecs;
  },
);

export { ECSProvider };
export const useECS = wrapContext(_useECS, 'ECS');

export type Archetype<Components extends keyof IEntity> = IEntity &
  Required<Pick<IEntity, Components>>;

export function useQuery<Components extends keyof IEntity>(
  query: Query | ((buildQuery: QueryBuilder) => QueryBuilder),
  emit = true,
): Accessor<Archetype<Components>[]> {
  const ecs = useECS();
  return from((setter) => {
    return ecs.subscribe(
      createEventSystem(
        (entities) => {
          return setter(
            entities.map((e) => ecs.entity(e) as Archetype<Components>),
          );
        },
        typeof query === 'function' ? query(createBuilder()).toQuery() : query,
      ),
      emit,
    );
  }) as Accessor<Archetype<Components>[]>;
}
