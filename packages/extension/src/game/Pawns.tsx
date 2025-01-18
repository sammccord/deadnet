import { componentIds } from '@deadnet/bebop/lib/components';
import type { FederatedPointerEvent } from 'pixi-unsafe';
import { For, createMemo } from 'solid-js';
import { unwrap } from 'solid-js/store';
import { Sprite, useSpritesheet } from 'solid-pixi-unsafe';
import { useECS, useQuery } from './ECSContext';
import { useGameConfig } from './GameConfigContext';
import { useMap } from './MapContext';
import { center } from './utils';

export function Pawns() {
  const { map } = useMap();
  const sheet = useSpritesheet();
  const [config] = useGameConfig();
  const pawns = useQuery<'position' | 'sprite'>((q) =>
    q.every(componentIds.sprite, componentIds.position),
  );

  return (
    <For each={pawns()}>
      {(entity) => {
        const position = createMemo(() => map.toWorldPoint(entity.position));
        function handleEvent(e: FederatedPointerEvent) {
          console.log(e);
        }
        return (
          <Sprite
            eventMode="static"
            onpointerover={handleEvent}
            onpointerleave={handleEvent}
            onpointerupoutside={handleEvent}
            onpointerdown={(e) => {
              e.stopPropagation();
              handleEvent(e);
            }}
            onrightdown={handleEvent}
            onpointerup={handleEvent}
            texture={sheet.textures[entity.sprite.texture!]}
            anchor={center}
            width={config.tileSize.x}
            height={config.tileSize.y}
            position={position()}
            zIndex={position().z}
          />
        );
      }}
    </For>
  );
}
