import {
  type ContextProviderProps,
  createContextProvider,
} from '@solid-primitives/context';
import type { FederatedPointerEvent } from 'pixi-unsafe';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';
import { useApplication, useParent } from 'solid-pixi-unsafe';
import { wrapContext } from './utils';

const [DraggableProvider, _useDraggable] = createContextProvider<
  Accessor<boolean>,
  ContextProviderProps
>(() => {
  const app = useApplication();
  const container = useParent();
  const [isDragging, setIsDragging] = createSignal(false);

  createEffect(() => {
    function onDragMove(e: FederatedPointerEvent) {
      if (e.movementX > 1 || e.movementY > 1) setIsDragging(true);
      container.position.x += e.movementX;
      container.position.y += e.movementY;
    }
    function onPointerDown(_e: FederatedPointerEvent) {
      app?.stage.on('pointermove', onDragMove);
    }
    function onDragEnd() {
      setIsDragging(false);
      app?.stage.off('pointermove', onDragMove);
    }
    container.on('pointerdown', onPointerDown);
    container.on('pointerup', onDragEnd);
    container.on('pointerupoutside', onDragEnd);
    onCleanup(() => {
      container.off('pointerdown', onPointerDown);
      container.off('pointerup', onDragEnd);
      container.off('pointerupoutside', onDragEnd);
      app?.stage.off('pointermove', onDragMove);
    });
  });

  return isDragging;
});

export { DraggableProvider };
export const useDragging = wrapContext(_useDraggable, 'Draggable');
