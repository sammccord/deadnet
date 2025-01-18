import { GameMode } from '@deadnet/bebop/lib/bebop';
import { Texture } from 'pixi-unsafe';
import { type PropsWithChildren, Show } from 'solid-js';
import { Application, Assets, SpriteSheet } from 'solid-pixi-unsafe';
import { CursorProvider } from './CursorContext';
import { DraggableProvider } from './DraggableContext';
import { useGameState } from './GameStateContext';
import { IcePlacement } from './IcePlacement';
import { MapContextProvider } from './MapContext';
import { useMode } from './ModeContext';
import { Pawns } from './Pawns';
import { Terrain } from './Terrain';
import { TileOutline } from './TileOutline';
import { sheetUrl, spritesheet } from './spritesheet';

export function Game(props: PropsWithChildren<{ container?: HTMLDivElement }>) {
  const [mode] = useMode();
  return (
    <Application
      resizeTo={props.container}
      eventMode="static"
      ref={(r) => {
        r.stage.hitArea = r.screen;
      }}
    >
      <Assets load={[[sheetUrl]]}>
        <SpriteSheet texture={Texture.from(sheetUrl)} data={spritesheet}>
          <MapContextProvider>
            <DraggableProvider>
              <CursorProvider>
                <Terrain />
                <TileOutline />
                <Pawns />
                <Show when={mode.type === 'icePlacement'}>
                  <IcePlacement />
                </Show>
                {props.children}
              </CursorProvider>
            </DraggableProvider>
          </MapContextProvider>
        </SpriteSheet>
      </Assets>
    </Application>
  );
}
