import type { IGeometry } from '@deadnet/bebop/lib/bebop';
import keyboard from 'keyboardjs';
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js';
import type { SetStoreFunction } from 'solid-js/store';
import {
  Container,
  type SpriteProps,
  useApplication,
  useSpritesheet,
} from 'solid-pixi-unsafe';
import { useCursor } from './CursorContext';
import { useECS } from './ECSContext';
import { useMap } from './MapContext';
import { type IcePlacementMode, useMode } from './ModeContext';
import { Tile, type TileProps } from './Tile';
import { terrain } from './prefabs';
import type { spritesheet } from './spritesheet';
import { positionFromIndex, rotateArray } from './utils';

export function IcePlacement() {
  const ecs = useECS();
  const { map } = useMap();
  const [mode, setMode] = useMode() as [
    IcePlacementMode,
    SetStoreFunction<IcePlacementMode>,
  ];
  const sheet = useSpritesheet<typeof spritesheet>();
  const { tile: _tile } = useCursor();

  createEffect(() => {
    const handler: keyboard.Callback = () => {
      setMode('entity', 'geometry', (geometry) => {
        return {
          dimensions: {
            x: geometry!.dimensions.y,
            y: geometry!.dimensions.x,
            z: geometry!.dimensions.z,
          },
          topology: rotateArray(
            geometry!.topology,
            geometry!.dimensions.x,
            geometry!.dimensions.y,
            geometry!.dimensions.z,
          ),
        };
      });
    };
    keyboard.on('r', handler);
    onCleanup(() => {
      keyboard.off('r', handler);
    });
  });

  const placement = createMemo(() => {
    const tile = _tile;
    const geometry = (mode as IcePlacementMode).entity.geometry!;
    const center = {
      x: Math.floor(geometry.dimensions.x / 2),
      y: Math.floor(geometry.dimensions.y / 2),
    };
    let valid = true;
    let tiles: Array<TileProps | undefined> = new Array(
      geometry.topology.length,
    );
    for (let i = 0; i < geometry.topology.length; i++) {
      const value = geometry.topology[i] as keyof typeof terrain;
      if (!value) {
        tiles.push(undefined);
        continue;
      }
      const localPosition = positionFromIndex(
        i,
        geometry.dimensions.x,
        geometry.dimensions.y,
        geometry.dimensions.z,
      );
      const tilePosition = {
        x: tile.x - (center.x - localPosition.x),
        y: tile.y - (center.y - localPosition.y),
        z: 0,
      };
      const occupied = map.get(tilePosition) !== undefined;
      if (occupied) valid = false;
      tiles.push({
        ...(occupied ? { tint: 'red' } : {}),
        texture: sheet.textures[terrain[value].sprite],
        position: tilePosition,
      });
    }
    return { valid, tiles, geometry };
  });

  return (
    <Container
      onpointerup={() => {
        if (!placement().valid) return;
        ecs.insert({
          position: { ..._tile, z: 0 },
          geometry: placement().geometry,
        });
        setMode({ type: 'idle' });
      }}
      interactive={true}
    >
      <For each={placement().tiles}>
        {(props) => {
          if (props === undefined) return null;
          return <Tile {...props} cullable interactive={false} />;
        }}
      </For>
    </Container>
  );
}
