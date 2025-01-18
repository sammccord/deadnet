import { Game } from './Game';
import { useMode } from './ModeContext';

export function DeckWindow() {
  const [, setMode] = useMode();
  return (
    <div class="window col-span-2">
      <div class="title-bar">
        <div class="title-bar-text">Deck</div>
      </div>
      <div class="window-body">
        <button
          onClick={() => {
            setMode({
              type: 'icePlacement',
              entity: {
                geometry: {
                  dimensions: { x: 3, y: 2, z: 1 },
                  topology: [0, 1, 0, 1, 1, 1],
                },
              },
            });
          }}
        >
          square
        </button>
      </div>
    </div>
  );
}
