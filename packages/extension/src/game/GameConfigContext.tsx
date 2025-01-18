import { GameMode, type IGameConfig } from '@deadnet/bebop/lib/bebop';
import {
  type ContextProviderProps,
  createContextProvider,
} from '@solid-primitives/context';
import { makePersisted } from '@solid-primitives/storage';
import {
  type SetStoreFunction,
  createMutable,
  createStore,
} from 'solid-js/store';
import { wrapContext } from './utils';

const [GameConfigProvider, _useGameConfig] = createContextProvider<
  [Required<IGameConfig>, SetStoreFunction<IGameConfig>],
  ContextProviderProps & { value?: IGameConfig }
>((props) => {
  const [config, setConfig] = makePersisted(
    createStore({
      id: '',
      size: { x: 50, y: 50, z: 5 },
      tileSize: { x: 64, y: 64, z: 32 },
      systems: [],
      ...props.value,
    }),
    { name: 'config' },
  );
  return [config, setConfig];
});

export { GameConfigProvider };
export const useGameConfig = wrapContext(_useGameConfig, 'GameConfig');
