import type { IEntity } from '@deadnet/bebop/lib/bebop';
import {
  type ContextProviderProps,
  createContextProvider,
} from '@solid-primitives/context';
import { makePersisted } from '@solid-primitives/storage';
import { type SetStoreFunction, createStore } from 'solid-js/store';
import { wrapContext } from './utils';

export interface IcePlacementMode {
  type: 'icePlacement';
  entity: IEntity;
}

export interface IdleMode {
  type: 'idle';
}

export type Mode = IcePlacementMode | IdleMode;

const [ModeProvider, _useMode] = createContextProvider<
  [Mode, SetStoreFunction<Mode>],
  ContextProviderProps & { value?: undefined }
>((_props) => {
  const [mode, setMode] = makePersisted(createStore<Mode>({ type: 'idle' }), {
    name: 'mode',
  });
  return [mode, setMode];
});

export { ModeProvider };
export const useMode = wrapContext(_useMode, 'Mode');
