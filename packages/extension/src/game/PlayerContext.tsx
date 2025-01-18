import type { IPlayer } from '@deadnet/bebop/lib/bebop';
import {
  type ContextProviderProps,
  createContextProvider,
} from '@solid-primitives/context';
import { makePersisted } from '@solid-primitives/storage';
import { type SetStoreFunction, createStore } from 'solid-js/store';
import { wrapContext } from './utils';

const [PlayerProvider, _usePlayer] = createContextProvider<
  [Required<IPlayer>, SetStoreFunction<IPlayer>],
  ContextProviderProps & { value?: IPlayer }
>((props) => {
  const [config, setConfig] = makePersisted(
    createStore({
      id: 'Player 1',
      ...props.value,
    }),
    { name: 'player' },
  );
  return [config, setConfig];
});

export { PlayerProvider };
export const usePlayer = wrapContext(_usePlayer, 'Player');
