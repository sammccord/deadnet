import type { IPoint } from '@deadnet/bebop/lib/bebop';
import type { PointData } from 'pixi-unsafe';
import { createMemo } from 'solid-js';
import { Sprite, type SpriteProps } from 'solid-pixi-unsafe';
import { useGameConfig } from './GameConfigContext';
import { useMap } from './MapContext';
import { center } from './utils';

export type TileProps = SpriteProps<{}> & { position: IPoint };

export function Tile(props: TileProps) {
  const { map } = useMap();
  const [config] = useGameConfig();
  const position = createMemo(() => map.toWorldPoint(props.position));

  return (
    <Sprite
      {...props}
      anchor={center as PointData}
      width={config.tileSize.x}
      height={config.tileSize.y}
      position={position() as PointData}
      zIndex={position().z}
    />
  );
}
