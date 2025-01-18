import { EntityCapacity } from '@deadnet/bebop/lib/bebop';
import type { FederatedPointerEvent } from 'pixi-unsafe';
import { Show, createEffect, createMemo, onCleanup } from 'solid-js';
import { Sprite, useSpritesheet } from 'solid-pixi-unsafe';
import { useCursor } from '../CursorContext';
import { useDragging } from '../DraggableContext';
import { useECS } from '../ECSContext';
import { useGameConfig } from '../GameConfigContext';
import { useMap } from '../MapContext';
import { pawns } from '../prefabs';
import type { spritesheet } from '../spritesheet';
import { center } from '../utils';
import { EditorMode, useDebug } from './DebugContext';

export function PawnPlacer() {
  const sheet = useSpritesheet<typeof spritesheet>();
  const [config] = useGameConfig();
  const { store } = useDebug();
  const { tile } = useCursor();
  const isDragging = useDragging();
  const { map, container } = useMap();
  const ecs = useECS();

  createEffect(() => {
    if (store.mode !== EditorMode.Pawns || isDragging()) return;
    function handler(_e: FederatedPointerEvent) {
      ecs.insert({
        ...pawns[store.pawn],
        position: {
          x: tile.x,
          y: tile.y,
          z: pawns[store.pawn].position?.z || 1,
        },
      });
    }
    container.addEventListener('pointerup', handler);
    onCleanup(() => {
      container.removeListener('pointerup', handler);
    });
  });

  const placement = createMemo(() => {
    return map.toWorldPoint({ ...tile, z: 1 });
  });

  return (
    <Show when={store.mode === EditorMode.Pawns}>
      <Sprite
        // @ts-expect-error
        texture={sheet.textures[pawns[store.pawn].sprite?.texture]}
        anchor={center}
        alpha={0.5}
        width={config.tileSize.x}
        height={config.tileSize.y}
        position={placement()}
        zIndex={EntityCapacity}
      />
    </Show>
  );
}
