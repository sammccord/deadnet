import { Message, TempoServiceRegistry } from '@deadnet/bebop/bebop';
import { ConsoleLogger, HookRegistry } from '@tempojs/common';
import { type ServerContext, TempoRouterConfiguration } from '@tempojs/server';
import { TempoWsRouter } from './router.ts';
import * as Services from './service.ts';
// temporary workaround for registry race condition
console.log(Services);

const logger = new ConsoleLogger('Router');
const registry = new TempoServiceRegistry(logger);
const config = new TempoRouterConfiguration();
const router = new TempoWsRouter<object>(logger, registry, config);

const hooks = new HookRegistry<ServerContext, object>({});
hooks.registerHook('request', (context) => {
  const headers: Record<string, string> = {};
  context.clientHeaders.forEach((v, k) => {
    headers[k] = v;
  });
  logger.info('headers', headers);
});

router.useHooks(hooks);

const server = Bun.serve<{}>({
  fetch(req, server) {
    // upgrade the request to a WebSocket
    if (server.upgrade(req)) {
      return; // do not return a Response
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    perMessageDeflate: true,
    publishToSelf: false,
    open(ws) {
      logger.debug('opened ws connection', ws.data)
    },
    message(ws, message) {
      logger.debug('received ws message', ws.data)
      router.process(message, new Message({}), ws)
    },
    close(ws) {
      logger.debug('closed ws connection', ws.data)
    },
  },
});

console.log(`Listening on ${server.hostname}:${server.port}`);
