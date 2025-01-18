import type { IMessage, Message } from '@deadnet/bebop/lib/bebop';
import { TempoWSChannel } from '@deadnet/bebop/lib/wsChannel';
import { TempoStatusCode } from '@tempojs/common';
import * as browser from 'webextension-polyfill';

// Establish a connection to the server using TempoChannel
const channel = TempoWSChannel.forAddress('http://localhost:3000', {
  reconnect: true,
});

// Get the GreeterClient from the channel
const clientHandlers: Map<string, EventListener> = new Map();

async function main() {
  browser.runtime.onMessage.addListener(async (msg, sender) => {
    const message = msg as IMessage;
    if (message.messageId && sender.tab?.id !== undefined) {
      const tabId = sender.tab.id;
      const messageId = message.messageId;
      const isListening = clientHandlers.has(messageId);
      if (!isListening) {
        // listen for incoming events on this message id
        const listener = (event: CustomEvent<Message>) => {
          if (event.detail.status === TempoStatusCode.CANCELLED) {
            channel.events.removeEventListener(
              messageId,
              listener as EventListener,
            );
          }
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          (event.detail as any).data = Array.apply(
            null,
            event.detail.data as any,
          );
          browser.tabs.sendMessage(tabId, event.detail);
        };
        channel.events.addEventListener(messageId, listener as EventListener);
      }
      message.data = new Uint8Array(message.data!);
      channel.send(message);
    }
    return undefined;
  });
}

channel.waitForOpen().then(main).catch(console.error).then(console.log);
