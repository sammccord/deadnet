import { GameMode } from '@deadnet/bebop/lib/bebop';
import { Show, createEffect } from 'solid-js';
import { useGameState } from '../GameStateContext';
import { EditorMode, useDebug } from './DebugContext';

export function DebugWindow() {
  let ref: HTMLDivElement;
  const { gui: _gui, setOptions } = useDebug();
  const [state] = useGameState();

  createEffect(() => {
    if (state.mode !== GameMode.Creative) return;
    setOptions({ container: ref, injectStyles: false });
  });

  return (
    <Show when={state.mode === GameMode.Creative}>
      <div class="window grid-cols-subgrid col-span-2">
        <div class="title-bar">
          <div class="title-bar-text">Debug</div>
          <div class="title-bar-controls">
            <button aria-label="Minimize"></button>
            <button aria-label="Maximize"></button>
            <button aria-label="Close"></button>
          </div>
        </div>
        <div class="window-body" ref={ref}></div>
      </div>
    </Show>
  );
}
