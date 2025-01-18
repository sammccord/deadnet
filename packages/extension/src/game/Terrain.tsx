import { componentIds } from '@deadnet/bebop/lib/components';
import { For } from 'solid-js';
import { Container, useSpritesheet } from 'solid-pixi-unsafe';
import { useQuery } from './ECSContext';
import { Tile } from './Tile';
import { terrain } from './prefabs';
import type { spritesheet } from './spritesheet';
import { positionFromIndex } from './utils';

export function Terrain() {
  const sheet = useSpritesheet<typeof spritesheet>();

  const entities = useQuery<'geometry' | 'position'>((q) =>
    q.every(componentIds.geometry, componentIds.position),
  );
  return (
    <Container sortableChildren>
      <For each={entities()}>
        {(entity) => {
          const { topology, dimensions } = entity.geometry;
          const centerX = Math.floor(dimensions.x / 2),
            centerY = Math.floor(dimensions.y / 2);
          return (
            <For each={topology}>
              {(_val, i) => {
                if (_val === 0) return null;
                const value = _val as keyof typeof terrain;
                const localPosition = positionFromIndex(
                  i(),
                  dimensions.x,
                  dimensions.y,
                  dimensions.z,
                );
                const tilePosition = {
                  x: entity.position.x - (centerX - localPosition.x),
                  y: entity.position.y - (centerY - localPosition.y),
                  z: entity.position.z,
                };
                return (
                  <Tile
                    texture={sheet.textures[terrain[value].sprite]}
                    position={tilePosition}
                    interactive={false}
                    cullable
                  />
                );
              }}
            </For>
          );
        }}
      </For>
    </Container>
  );
}
