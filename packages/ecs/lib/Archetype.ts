import type { TypedFastBitSet } from 'typedfastbitset';
import { type SparseSet, createSparseSet } from './SparseSet';

export type Archetype = {
  readonly mask: TypedFastBitSet;
  readonly entitySet: SparseSet;
  readonly adjacent: Archetype[];
  /**
   * The id of the archetype is a hexadecimal representation of a set of unique bits for all of the `componentIds`
   */
  readonly id: string;
  /**
   * All the entities currently in this archetype
   */
  readonly entities: number[];
  /**
   * Check if an entity is currently included in this archetype
   */
  hasEntity(entity: number): boolean;
  /**
   * Check if this archetype has a `componentId`.
   * This is typically much faster than checking if `componentIds` includes a given componentId
   */
  hasComponent(component: number): boolean;
  /**
   * All the `componentIds` constituting this archetype
   */
  componentIds(): number[];
};

export function createArchetype(id: string, mask: TypedFastBitSet): Archetype {
  const entitySet = createSparseSet();
  const adjacent: Archetype[] = [];

  return Object.freeze({
    id,
    mask,
    entitySet,
    adjacent,
    entities: entitySet.values,
    hasEntity: entitySet.has,
    hasComponent(component: number) {
      return mask.has(component);
    },
    componentIds() {
      return mask.array();
    },
  });
}

export function transformArchetype(
  archetype: Archetype,
  componentId: number,
): Archetype {
  if (archetype.adjacent[componentId] !== undefined) {
    return archetype.adjacent[componentId]!;
  }

  // Mutate the current mask in order to avoid creating garbage (in case the archetype already exists)
  const mask = archetype.mask;
  mask.flip(componentId);
  const nextId = mask.toString();

  let existingArchetype: Archetype | null = null;
  traverseArchetypeGraph(archetype, (node) => {
    if (node === archetype) return;
    if (node.id === nextId) {
      existingArchetype = node;
      return false;
    }
    return existingArchetype === null;
  });

  const transformed =
    existingArchetype || createArchetype(nextId, mask.clone());
  // reset current mask of input archetype, see comment above
  mask.flip(componentId);
  transformed.adjacent[componentId] = archetype;
  archetype.adjacent[componentId] = transformed;
  return transformed;
}

export function traverseArchetypeGraph(
  archetype: Archetype,
  callback: (archetype: Archetype) => boolean | void,
  traversed = new Set<Archetype>(),
): boolean {
  traversed.add(archetype);
  if (callback(archetype) === false) return false;
  const adjacent = archetype.adjacent;
  for (let i = 0, l = adjacent.length; i < l; i++) {
    const arch = adjacent[i];
    // adjacent is sparse, so there can be empty slots
    if (arch === undefined) continue;
    // graph is doubly linked, so need to prevent infinite recursion
    if (traversed.has(arch)) continue;
    if (traverseArchetypeGraph(arch, callback, traversed) === false)
      return false;
  }
  return true;
}
