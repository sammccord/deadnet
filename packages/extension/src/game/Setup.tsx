import type { IPoint } from '@deadnet/bebop/lib/bebop';
import RecursiveShadowcasting from '@deadnet/rot/lib/fov/recursive-shadowcasting';
import { createEffect } from 'solid-js';
import { useECS } from './ECSContext';
import { useGameConfig } from './GameConfigContext';
import { useGameState } from './GameStateContext';
import { useMap } from './MapContext';
import { tryFindFirstPositionMatching } from './utils';

export function Setup() {
  const [state, setState] = useGameState();
  const [config, setConfig] = useGameConfig();
  const { map } = useMap();
  const { ecs } = useECS();

  createEffect(() => {
    if (state.initialized) return;
    // set up initial entities
    // TODO extract into setup functions

    // spawn root access point in center
    const cx = Math.floor(config.size.x / 2),
      cy = Math.floor(config.size.y / 2);

    const fov = new RecursiveShadowcasting(
      (x, y) => {
        return map.get({ x, y, z: 0 }) !== undefined;
      },
      { topology: 4 },
    );

    setState('initialized', true);
  });

  // register systems
  createEffect(() => {
    ecs.initialize();
  });

  return null;
}
