import { TempoServiceRegistry } from '@deadnet/bebop';
/// <reference lib="deno.ns" />
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
    const url = new URL(req.url);
    if (url.pathname === "/chat") {
      console.log(`upgrade!`);
      // const username = getUsernameFromReq(req);
      const success = server.upgrade(req, { data: {} });
      return success
        ? undefined
        : new Response("WebSocket upgrade error", { status: 400 });
    }

    return new Response("Hello world");
  },
  websocket: {
    open(ws) {
      const msg = `${ws.data} has entered the chat`;
      ws.subscribe("the-group-chat");
      server.publish("the-group-chat", msg);
    },
    message(ws, message) {
      // this is a group chat
      // so the server re-broadcasts incoming message to everyone
      server.publish("the-group-chat", `${ws.data}: ${message}`);
      router.process(message,)
    },
    close(ws) {
      const msg = `${ws.data} has left the chat`;
      ws.unsubscribe("the-group-chat");
      server.publish("the-group-chat", msg);
    },
  },
});

console.log(`Listening on ${server.hostname}:${server.port}`);
