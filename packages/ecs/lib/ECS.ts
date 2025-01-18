import { TypedFastBitSet } from 'typedfastbitset';
import {
  type Archetype,
  createArchetype,
  transformArchetype,
  traverseArchetypeGraph,
} from './Archetype';
import {
  EntityDeletedError,
  EntityNotExistError,
  EntityUndefinedError,
  WorldNotInitializedError,
} from './Errors';
import type { Query, QueryBuilder } from './Query';
import { query } from './Query';
import type { EventSystem, LifecycleSystem, System } from './System';

export type EntityCallback = (
  entity: number,
  archetype: Archetype,
) => unknown | Promise<unknown>;

export interface ECSOptions<Entity> {
  exists: (e: Entity) => boolean;
  components: Record<keyof Entity, number>;
}

export class ECS<
  Entity extends { id?: number; parent?: number; player?: string },
  TUpdateArguments extends Array<unknown>,
> {
  readonly rootArchetype: Archetype = createArchetype(
    'root',
    new TypedFastBitSet(),
  );
  readonly entityArchetype: Archetype[] = [];
  readonly deletedEntities: number[] = [];
  readonly systems: System<TUpdateArguments>[] = [];
  readonly subscriptions: EventSystem[] = [];
  readonly _onCreate: LifecycleSystem[] = [];
  readonly _onDelete: LifecycleSystem[] = [];

  nextEntityId = 0 >>> 0;
  deferred: (() => void)[] = [];
  initialized = false;

  protected readonly _entities: Array<Entity>;
  protected readonly _mutate: (...args: unknown[]) => void;
  protected readonly options: ECSOptions<Entity>;

  constructor(
    entities: Array<Entity>,
    mutate: (...args: unknown[]) => void,
    options: ECSOptions<Entity>,
  ) {
    this._entities = entities;
    this._mutate = mutate;
    this.options = options;
  }

  public entity(id: number): Entity {
    return this._entities[id];
  }

  public get entities() {
    return this._entities.filter(this.options.exists);
  }

  public insert(entity: Entity): Entity {
    const id = this.createEntity(undefined, entity.id, false);
    // assign generated id to entity
    if (!entity.id) entity.id = id;
    this._mutate(id, entity);
    for (const component in entity) {
      if (entity[component] === undefined) continue;
      this.addComponent(id, this.options.components[component], false);
    }
    this.executeEventSystems(id);
    this._handleCreate(id);
    return entity;
  }

  public put(patch: Entity, mutating = false): Entity {
    const id = patch.id;
    if (!id) return this.insert(patch);
    const entity = this.entity(id);
    // entity does not exist, insert
    if (entity.id !== id) return this.insert(patch);
    // patch the existing entity
    let executing = false;
    const base: Partial<Entity> = {};
    for (const component in patch) {
      const value = patch[component];
      // are we changing the component structure into another archetype?
      if (mutating && value === undefined) {
        this._mutate(id, component, undefined);
        base[component as keyof Entity] = undefined;
        this.removeComponent(id, this.options.components[component], false);
        executing = true;
      } else {
        const original = entity[component];
        base[component] = original;
        this._mutate(id, component, value);
        if (original === undefined) {
          this.addComponent(id, this.options.components[component], false);
          executing = true;
        }
      }
    }
    if (executing) this.executeEventSystems(id);
    return base as Entity;
  }

  public delete(entity: Entity) {
    const id = entity.id;
    if (id === undefined) {
      console.warn('no id provided for deletion');
      return;
    }
    const e = this.entity(id);
    this._mutate(id, {});
    this.deleteEntity(id);
    return e;
  }

  public query(
    _query: Query | ((builder: QueryBuilder) => QueryBuilder),
  ): number[] {
    const q = typeof _query === 'function' ? query(_query) : _query;
    const archetypes: Archetype[] = [];
    traverseArchetypeGraph(this.rootArchetype, (archetype) => {
      if (q.tryAdd(archetype, false)) archetypes.push(archetype);
    });

    const entities: number[] = [];
    // reverse iterating in case a system adds/removes component resulting in new archetype that matches query for the system
    for (let a = 0; a < archetypes.length; a++) {
      const arch = archetypes[a];
      entities.push(...arch.entities);
    }
    return entities;
  }

  public subscribe(system: EventSystem, emit = false): () => void {
    const i = this.subscriptions.push(system);

    if (this.initialized) {
      traverseArchetypeGraph(this.rootArchetype, (archetype) => {
        system.query.tryAdd(archetype);
        return true;
      });
    }

    if (emit) {
      this._executeEventSystem(system);
    }

    return () => this.subscriptions.splice(i - 1, 1);
  }

  public onCreate(system: LifecycleSystem) {
    const l = this._onCreate.push(system);
    if (this.initialized) {
      traverseArchetypeGraph(this.rootArchetype, (archetype) => {
        system.query.tryAdd(archetype);
        return true;
      });
    }
    return () => this._onCreate.splice(l - 1);
  }

  public onDelete(system: LifecycleSystem) {
    const l = this._onDelete.push(system);
    if (this.initialized) {
      traverseArchetypeGraph(this.rootArchetype, (archetype) => {
        system.query.tryAdd(archetype);
        return true;
      });
    }
    return () => this._onDelete.splice(l - 1);
  }

  private _executeEventSystems(archetype: Archetype) {
    const systems = this.subscriptions;
    for (let s = 0, sl = systems.length; s < sl; s++) {
      const system = systems[s];
      if (system.query.archetypes.has(archetype))
        this._executeEventSystem(system);
    }
  }

  private _executeEventSystem(sys: EventSystem) {
    const archetypes = sys.query.archetypes;
    const entities: number[] = [];
    for (const arch of archetypes) {
      entities.push(...arch.entities);
    }
    sys.execute(entities);
  }

  private _executeDeferred() {
    if (this.deferred.length === 0) return;
    for (let i = 0; i < this.deferred.length; i++) {
      this.deferred[i]();
    }
    this.deferred.length = 0;
  }

  private _tryAddArchetypeToQueries(archetype: Archetype) {
    const systems = ([] as System[]).concat(
      this.systems,
      this.subscriptions,
      this._onCreate,
      this._onDelete,
    );

    for (let i = 0, l = systems.length; i < l; i++) {
      systems[i].query.tryAdd(archetype);
    }
  }

  private _assertEntity(entity: number) {
    if (this.entityArchetype[entity] === undefined) {
      if (entity === undefined) {
        throw new EntityUndefinedError();
      } else if (this.deletedEntities.includes(entity)) {
        throw new EntityDeletedError(entity);
      }
      throw new EntityNotExistError(entity);
    }
  }

  private _transformEntityForComponent(
    current: Archetype,
    entity: number,
    componentId: number,
  ): Archetype {
    current.entitySet.remove(entity);

    if (current.adjacent[componentId] !== undefined) {
      current = current.adjacent[componentId];
    } else {
      current = transformArchetype(current, componentId);
      if (this.initialized) {
        this._tryAddArchetypeToQueries(current);
      }
    }

    current.entitySet.add(entity);
    this.entityArchetype[entity] = current;
    return current;
  }

  /**
   * Provide a known combination of `componentIds` constituting an archetype.
   * The component ids can be of your choosing, but be carefull not to use the same id for different components.
   * You should either create all `componentIds` using `createComponentId` first and use the created component ids in the prefacbricate,
   * Or make all of you prefabricates before creating new component ids using `createComponentId`
   */
  prefabricate(components: number[]): Archetype {
    let archetype = this.rootArchetype;

    for (let i = 0, l = components.length; i < l; i++) {
      const componentId = components[i];

      if (archetype.adjacent[componentId] !== undefined) {
        archetype = archetype.adjacent[componentId];
      } else {
        archetype = transformArchetype(archetype, componentId);
        if (this.initialized) {
          this._tryAddArchetypeToQueries(archetype);
        }
      }
    }
    return archetype;
  }

  /**
   * Registers a system to be executed for each update cycle.
   * Use the `createEntitySystem` or `createArchetypeSystem` helpers to create the system.
   * A system may not be executed if it's `Query` does not match any `Archetype`s.
   */
  registerSystem(system: System<TUpdateArguments>) {
    const i = this.systems.push(system);

    if (this.initialized) {
      traverseArchetypeGraph(this.rootArchetype, (archetype) => {
        system.query.tryAdd(archetype);
        return true;
      });
    }

    return () => this.systems.splice(i - 1, 1);
  }

  /**
   * Initialize the world, must be done before the first update.
   * Subsequent calls to initialize will be voided.
   */
  initialize() {
    if (this.initialized) return;
    this.initialized = true;

    traverseArchetypeGraph(this.rootArchetype, (arch) =>
      this._tryAddArchetypeToQueries(arch),
    );
  }

  /**
   * Update the world, executing all registered systems with queries matching 1 or more `Archetype`.
   * Typically you want to call `update` on each animation frame (`window.requestAnimationFrame`).
   * @throws {WorldNotInitializedError} if `initialized` has not been called
   */
  update(...args: TUpdateArguments) {
    if (!this.initialized) throw new WorldNotInitializedError();

    const systems = this.systems;
    for (let s = 0, sl = systems.length; s < sl; s++) {
      const system = systems[s];
      const archetypes = system.query.archetypes;
      if (system.type === 1) {
        system.execute(archetypes, this, ...args);
      }
      if (system.type === 0) {
        // reverse iterating in case a system adds/removes component resulting in new archetype that matches query for the system
        for (const arch of archetypes) {
          system.execute(arch.entities, this, ...args);
        }
      }
    }

    this._executeDeferred();
  }

  /**
   * Defer execution of an action until the end of the update cycle (after all systems has been executed)
   * For best performance you try to defer a batched action instead of many small actions, or avoid defering if possbile
   */
  defer(action: () => void) {
    this.deferred.push(action);
  }

  /**
   * Check if the entity exists in the world
   */
  hasEntity(entity: number): boolean {
    return this.entityArchetype[entity] !== undefined;
  }

  /**
   * Create an entity.
   * An entity is just an Id.
   * Previously deleted entity id's will be reused
   * Optionally supply a prefacbricated archetype
   */
  createEntity(
    prefabricate: Archetype = this.rootArchetype,
    id?: number,
    executeSystems = true,
  ): number {
    let entity: number;
    if (id !== undefined) {
      entity = id;
      this.nextEntityId = Math.max(entity, this.nextEntityId);
    } else {
      entity =
        this.deletedEntities.length > 0
          ? this.deletedEntities.pop()!
          : this.nextEntityId++;
    }

    const archetype = prefabricate as Archetype;
    archetype.entitySet.add(entity);
    this.entityArchetype[entity] = archetype;

    if (executeSystems) {
      this._executeEventSystems(archetype);
      this._handleCreate(entity);
    }
    return entity;
  }

  protected _handleCreate(entity: number) {
    for (let i = 0; i < this._onCreate.length; i++) {
      const system = this._onCreate[i];
      const archetypes = system.query.archetypes;
      if (archetypes.has(this.entityArchetype[entity])) system.execute(entity);
    }
  }

  /**
   * Delete an entity, removing it from its current archetype (loosing all of its components).
   * @throws {EntityUndefinedError | EntityDeletedError | EntityNotExistError}
   */
  deleteEntity(entity: number) {
    this._assertEntity(entity);

    const archetype = this.entityArchetype[entity];
    archetype.entitySet.remove(entity);
    // much faster than delete operator, but achieves the same (ish)
    // an alternative is to leave it be, and use archetype.entitySet.has(entity) as a check for entity being deleted, but that too is a little slower.
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    this.entityArchetype[entity] = undefined as any;
    this.deletedEntities.push(entity);
    this._executeEventSystems(archetype);
    this._handleDelete(entity, archetype);
  }

  private _handleDelete(entity: number, _archetype: Archetype) {
    for (let i = 0; i < this._onDelete.length; i++) {
      const system = this._onDelete[i];
      const archetypes = system.query.archetypes;
      if (archetypes.has(this.entityArchetype[entity])) system.execute(entity);
    }
  }

  /**
   * Transform the entity to that of a prefabricated archetype.
   * Any components added to the entity that does not exist in the prefabricate will be removed.
   * This is a sligthly faster operation than adding/subtracting components
   * @throws {EntityUndefinedError | EntityDeletedError | EntityNotExistError}
   */
  transformEntity(entity: number, prefabricate: Archetype) {
    this._assertEntity(entity);

    if (this.entityArchetype[entity] === prefabricate) return;

    // Transform resets all components on the entity to that of the prefab..
    this.entityArchetype[entity].entitySet.remove(entity);
    const archetype = prefabricate as Archetype;
    archetype.entitySet.add(entity);
    this.entityArchetype[entity] = archetype;
    this._executeEventSystems(archetype);
  }

  /**
   * Check if the entity has a componentId
   */
  hasComponent(entity: number, component: number): boolean {
    return (
      this.entityArchetype[entity] !== undefined &&
      this.entityArchetype[entity]!.mask.has(component)
    );
  }

  /**
   * Adds the componentId to the entity.
   * The entity will be moved to a different archetype
   * @throws {EntityUndefinedError | EntityDeletedError | EntityNotExistError}
   */
  addComponent(entity: number, component: number, executeSystems = true) {
    this._assertEntity(entity);
    const archetype = this.entityArchetype[entity];
    if (!archetype.mask.has(component)) {
      const next = this._transformEntityForComponent(
        archetype,
        entity,
        component,
      );
      if (executeSystems) this._executeEventSystems(next);
    }
  }

  /**
   * Removes the componentId from the entity.
   * The entity will be moved to a different archetype
   * @throws {EntityUndefinedError | EntityDeletedError | EntityNotExistError}
   */
  removeComponent(entity: number, component: number, executeSystems = true) {
    this._assertEntity(entity);
    const archetype = this.entityArchetype[entity];

    if (archetype.mask.has(component)) {
      const next = this._transformEntityForComponent(
        archetype,
        entity,
        component,
      );
      if (executeSystems) this._executeEventSystems(next);
    }
  }

  executeEventSystems(id: number) {
    this._assertEntity(id);
    this._executeEventSystems(this.entityArchetype[id]);
  }

  public validOwner(ownerId: string, entity?: Entity): boolean {
    if (!entity) return false;
    if (entity.player === ownerId) return true;
    if (entity.parent !== undefined)
      return this.validOwner(ownerId, this.entity(entity.parent));
    return false;
  }
}
