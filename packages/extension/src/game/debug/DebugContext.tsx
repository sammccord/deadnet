import { GameMode, type IEntity } from '@deadnet/bebop/lib/bebop';
import { componentIds } from '@deadnet/bebop/lib/components';
import EllerMaze from '@deadnet/rot/lib/map/ellermaze';
import RNG from '@deadnet/rot/lib/rng';
import {
  type ContextProviderProps,
  createContextProvider,
} from '@solid-primitives/context';
import GUI from 'lil-gui';
import merge from 'lodash-es/merge';
import set from 'lodash-es/set';
import {
  type Accessor,
  type Setter,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js';
import {
  type SetStoreFunction,
  createMutable,
  createStore,
  unwrap,
} from 'solid-js/store';
import { useECS, useQuery } from '../ECSContext';
import { useGameConfig } from '../GameConfigContext';
import { useGameState } from '../GameStateContext';
import { pawns, terrain } from '../prefabs';
import { indexFromPosition, wrapContext } from '../utils';

export interface DebugProps {
  autoPlace?: boolean;
  container?: HTMLElement;
  width?: number;
  title?: string;
  closeFolders?: boolean;
  injectStyles?: boolean;
  touchStyles?: number;
  parent?: GUI;
}

export enum EditorMode {
  Terrain,
  Pawns,
}

export interface DebugStore {
  mode: EditorMode;
  terrain: number;
  pawn: keyof typeof pawns;
  generateMaze: () => void;
  selectedEntity: number;
}

const entityPlaceholder: Required<IEntity> = {
  id: 0,
  parent: 0,
  children: [],
  position: { x: 0, y: 0, z: 0 },
  sprite: {
    // url: '',
    texture: '',
  },
  mana: {
    points: 0,
    min: 0,
    max: 0,
    rate: 0,
    intervalMs: 0,
  },
  name: '',
  ticking: false,
  player: '',
};

const [DebugProvider, _useDebug] = createContextProvider<
  {
    gui: Accessor<GUI>;
    store: DebugStore;
    setOptions: Setter<DebugProps>;
  },
  ContextProviderProps & { value?: DebugProps }
>((props) => {
  const ecs = useECS();
  const [state, setState] = useGameState();
  const [config, _setConfig] = useGameConfig();
  const [options, setOptions] = createSignal<DebugProps>({});
  const _gui = createMemo(() => new GUI(props.value || options()));

  const store = createMutable<DebugStore>({
    mode: EditorMode.Terrain,
    terrain: terrain[1].id,
    pawn: Object.keys(pawns)[0],
    selectedEntity: 0,
    generateMaze: () => {
      RNG.setSeed(Math.random());
      const maze = new EllerMaze(config.size.x, config.size.y);
      const newMap = new Array(config.size.x * config.size.y * config.size.z);
      maze.create((x, y, v) => {
        newMap[
          indexFromPosition(
            x,
            y,
            0,
            config.size.x,
            config.size.y,
            config.size.z,
          )
        ] = v === 1 ? 0 : terrain[1].id;
      });
      setState('terrain', newMap);
    },
  });

  createEffect(() => {
    const gui = _gui();
    if (state.mode !== GameMode.Creative) {
      gui.destroy();
      return;
    }
    // Change game state
    untrack(() => {
      const stateFolder = gui.addFolder('State');
      stateFolder.add(state, 'mode', GameMode);
      // Editor Mode
      const editorFolder = gui.addFolder('Map Editor');
      editorFolder.add(store, 'generateMaze');
      editorFolder.add(store, 'mode', EditorMode);
      editorFolder.add(
        store,
        'terrain',
        Object.values(terrain).reduce(
          (acc, curr) => {
            acc[curr.name] = curr.id;
            return acc;
          },
          {} as Record<string, number>,
        ),
      );
      editorFolder.add(store, 'pawn', Object.keys(pawns));
      // Pawn editor
    });
  });

  const entities = useQuery((q) => q.every(componentIds.id));

  createEffect(() => {
    const gui = _gui();
    const controller = gui.add(
      store,
      'selectedEntity',
      entities().reduce(
        (acc, curr) => {
          acc[curr.name || curr.id] = curr.id;
          return acc;
        },
        {} as Record<string, number>,
      ),
    );
    onCleanup(() => {
      controller.destroy();
    });
  });

  createEffect(() => {
    const gui = _gui();
    const eid = store.selectedEntity;
    if (eid === undefined) return;
    const selectedEntity = untrack(() => unwrap(entities()[eid]));
    if (!selectedEntity) return;

    const entityFolder = gui.addFolder('Entity');
    onCleanup(() => {
      entityFolder.destroy();
    });

    function buildEntityDebugger(
      placeholder: any,
      debugObj: any,
      folder: GUI,
      updatePath: Array<string>,
    ) {
      for (const k in placeholder) {
        const v = placeholder[k];
        const component = (updatePath.at(0) || k) as keyof IEntity;
        if (typeof v === 'object' && !Array.isArray(v) && v !== null) {
          const newFolder = folder.addFolder(k);
          buildEntityDebugger(v, debugObj[k], newFolder, [...updatePath, k]);
        } else if (Array.isArray(v)) {
          // folder.add(debugObj, k);
        } else {
          let obj = debugObj[k] !== undefined ? debugObj : placeholder;
          const controller = folder.add(obj, k).onChange((value: any) => {
            if (selectedEntity[component] === undefined)
              (selectedEntity as any)[component] = structuredClone(
                entityPlaceholder[component],
              );
            set(selectedEntity, [...updatePath, k], value);
            let current = structuredClone(selectedEntity[component]);
            if (!current) {
              ecs.put(
                {
                  id: eid,
                  [component]: current,
                },
                true,
              );
            } else {
              ecs.put({
                id: eid,
                [component]: current,
              });
            }
            controller.updateDisplay();
          });

          if (typeof v === 'number') {
            controller.step(1).min(0);
          }
        }
      }
    }
    buildEntityDebugger(entityPlaceholder, selectedEntity, entityFolder, []);
  });

  // onCleanup(() => {
  //   _gui().destroy();
  // });

  return {
    gui: _gui,
    setOptions,
    store,
  };
});

export { DebugProvider };
export const useDebug = wrapContext(_useDebug, 'Debug');
