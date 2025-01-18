import { Game } from './Game';

export function GameWindow() {
  let inner: HTMLDivElement;
  return (
    <div class="window col-span-10">
      <div class="title-bar">
        <div class="title-bar-text">Game View</div>
      </div>
      <div class="window-body">
        <div ref={inner!}>
          <Game container={inner!} />
        </div>
      </div>
    </div>
  );
}
