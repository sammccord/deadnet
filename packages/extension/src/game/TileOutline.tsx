import { Graphics } from 'solid-pixi-unsafe';
import { useCursor } from './CursorContext';
import { useGameConfig } from './GameConfigContext';
import { useMap } from './MapContext';

export function TileOutline() {
  const { container } = useMap();
  const { point } = useCursor();
  const [config] = useGameConfig();
  return (
    <Graphics
      draw={[
        ['clear'],
        [
          'rect',
          point.x - (config.tileSize.y / 2) * container.scale.x,
          point.y - (config.tileSize.y / 2) * container.scale.y,
          config.tileSize.x * container.scale.x,
          (config.tileSize.y / 2) * container.scale.y,
        ],
        ['stroke', { width: 2, color: 0xffffff }],
      ]}
    />
  );
}
