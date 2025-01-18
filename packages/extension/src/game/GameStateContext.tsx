import { GameMode, type IGameState } from '@deadnet/bebop/lib/bebop';
import {
  type ContextProviderProps,
  createContextProvider,
} from '@solid-primitives/context';
import { makePersisted } from '@solid-primitives/storage';
import { type SetStoreFunction, createStore } from 'solid-js/store';
import { wrapContext } from './utils';

const [GameStateProvider, _useGameState] = createContextProvider<
  [Required<IGameState>, SetStoreFunction<IGameState>],
  ContextProviderProps & { value?: IGameState }
>((props) => {
  const [state, setState] = makePersisted(
    createStore({
      mode: GameMode.Creative,
      initialized: false,
      ...props.value,
    }),
    { name: 'state' },
  );

  return [state, setState];
});

export { GameStateProvider };
export const useGameState = wrapContext(_useGameState, 'GameState');
