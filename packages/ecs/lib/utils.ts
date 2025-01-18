import { type Archetype, traverseArchetypeGraph } from './Archetype';
import type { ECS } from './ECS';

type ArchetypeStatistics = {
  /**
   * Count of entities in the archetype
   */
  entities: number;
  /**
   * The id of archetypes with 1 differing componentId
   */
  adjacent: string[];
  /**
   * All the `componentIds` constituting this archetype
   */
  componentIds: number[];
} & Pick<Archetype, 'id'>;

function getArchetypeStatistics(archetype: Archetype): ArchetypeStatistics {
  return {
    id: archetype.id,
    componentIds: archetype.componentIds(),
    entities: archetype.entitySet.values.length,
    adjacent: archetype.adjacent
      .filter((a): a is Archetype => !!a)
      .map((a) => a.id),
  };
}

export type WorldStatistics = {
  /**
   * Count of entities in the world
   */
  entities: number;
  /**
   * Name or index of all systems registered in the world
   */
  systems: string[];
  /**
   * Statistics for all queries in the world
   */
  queries: {
    /**
     * `ArchetypeStatistics` for matching archetypes in this query
     */
    archetypes: ArchetypeStatistics[];
  }[];
  /**
   * `ArchetypeStatistics` for all archetypes in the world
   */
  archetypes: ArchetypeStatistics[];
};

export function getStatistics<Entity, Args extends Array<unknown>>(
  world: ECS<Entity, Args>,
): WorldStatistics {
  const archetypes: Array<ArchetypeStatistics> = [];
  traverseArchetypeGraph(world.rootArchetype, (archetype) => {
    archetypes.push(getArchetypeStatistics(archetype));
  });
  return {
    entities: world.nextEntityId,
    systems: world.systems.map(
      (system, i) => system.execute.name || i.toString(),
    ),
    queries: world.systems.map((system) => ({
      archetypes: Array.from(system.query.archetypes).map((a) =>
        getArchetypeStatistics(a),
      ),
    })),
    archetypes,
  };
}
