import {
  type ContextProviderProps,
  createContextProvider,
} from '@solid-primitives/context';
import type { IPoint3 } from 'iceoh';
import type { FederatedPointerEvent } from 'pixi-unsafe';
import { batch, createEffect, onCleanup } from 'solid-js';
import { createStore } from 'solid-js/store';
import { useMap } from './MapContext';
import { wrapContext } from './utils';

interface Cursor {
  point: IPoint3;
  tile: IPoint3;
}

const [CursorProvider, _useCursor] = createContextProvider<
  Cursor,
  ContextProviderProps
>(() => {
  const { container, map } = useMap();
  const [point, setPoint] = createStore<IPoint3>({ x: 0, y: 0, z: 0 });
  const [tile, setTile] = createStore<IPoint3>({ x: 0, y: 0, z: 0 });

  createEffect(() => {
    function onMouseMove(e: FederatedPointerEvent) {
      batch(() => {
        const t = map.worldToTile(container.toLocal(e.global));
        setTile(t);
        setPoint(map.toWorldPoint(t));
      });
    }

    container.on('pointermove', onMouseMove);
    onCleanup(() => {
      container.off('pointermove', onMouseMove);
    });
  });

  return { point, tile };
});

export { CursorProvider };
export const useCursor = wrapContext(_useCursor, 'Cursor');
