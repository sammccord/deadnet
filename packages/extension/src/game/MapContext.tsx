import { componentIds } from '@deadnet/bebop/lib/components';
import { IsoTilemap, MIDDLE, TOP_LEFT, type Tilemap } from 'iceoh';
import { Container as PIXIContainer, Point, Rectangle } from 'pixi-unsafe';
import {
  type JSXElement,
  createContext,
  createEffect,
  createMemo,
  onCleanup,
  useContext,
} from 'solid-js';
import { useApplication } from 'solid-pixi-unsafe';
import { Container } from 'solid-pixi-unsafe';
import { useQuery } from './ECSContext';
import { useGameConfig } from './GameConfigContext';
import { collectGeometryPositions } from './utils';

export type MapContextValue = {
  container: PIXIContainer;
  map: IsoTilemap<number>;
};

export const MapContext = createContext<MapContextValue>();

export function useMap() {
  return useContext(MapContext) as MapContextValue;
}

export function MapContextProvider(props: { children: JSXElement }) {
  const [config] = useGameConfig();
  const app = useApplication();
  const container = new PIXIContainer({ isRenderGroup: true });

  const map = new IsoTilemap<number>({
    getScreenDimensions: () => {
      return app?.canvas.getBoundingClientRect() || { width: 0, height: 0 };
    },
    getWorldPosition: () => {
      return container.position || { x: 0, y: 0 };
    },
    getWorldScale: () => {
      return container.scale || { x: 1, y: 1 };
    },
    baseTileDimensions: {
      width: config.tileSize.x,
      height: config.tileSize.y,
      depth: config.tileSize.z,
    },
  });

  const entities = useQuery<'id' | 'position' | 'geometry'>(
    (q) => q.every(componentIds.position),
    true,
  );

  // for every entity with a position component, sync it in the map, and unset it afterwards
  createEffect(() => {
    const cleanups: Array<() => void> = [];
    for (const entity of entities()) {
      const points = collectGeometryPositions(entity.position, entity.geometry);
      cleanups.push(...map.setMany(points.map((p) => [entity.id, p] as const)));
    }
    onCleanup(() => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    });
  });

  const dimensions = createMemo(
    () =>
      new Rectangle(
        0,
        0,
        config.size.x * config.tileSize.x,
        config.size.y * config.tileSize.y,
      ),
  );

  return (
    <MapContext.Provider value={{ container, map }}>
      <Container
        as={container}
        eventMode="static"
        hitArea={dimensions()}
        scale={1}
        x={-(dimensions().width / 2)}
        y={-(dimensions().height / 2)}
        anchor={0.5}
      >
        {props.children}
      </Container>
    </MapContext.Provider>
  );
}
