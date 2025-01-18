import type { GreeterClient } from '@deadnet/bebop/lib/bebop';
import {
  type ContextProviderProps,
  createContextProvider,
} from '@solid-primitives/context';
import { wrapContext } from './utils';

const [RPCProvider, _useRPC] = createContextProvider<
  GreeterClient,
  ContextProviderProps & { client: GreeterClient }
>((props) => {
  return props.client;
});

export { RPCProvider };
export const useRPC = wrapContext(_useRPC, 'RPC');
