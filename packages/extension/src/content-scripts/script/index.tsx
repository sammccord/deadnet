import { GreeterClient } from '@deadnet/bebop/bebop'
// import { TempoExtensionChannel } from '@deadnet/bebop/extensionChannel'
import { render } from 'solid-js/web'
import { App } from './App'

// Establish a connection to the server using TempoChannel
// const channel = new TempoExtensionChannel()

// Get the GreeterClient from the channel
// const client = channel.getClient(GreeterClient)

async function main() {
  const shadow = document.body.attachShadow({ mode: 'open' })
  const target = document.createElement('div')
  shadow.appendChild(target)
  // Start loading right away and create a promise

  render(() => <App />, target)
  // console.log('\n\n----- Client is ready and sending unary request... -----');

  // // Send a unary request
  // const unaryResponse = await client.sayHello({ name: 'World' });
  // console.log('Unary response: ', unaryResponse, '\n\n');

  // // Define an asynchronous generator for client streaming
  // const clientGenerator = async function* gen() {
  //   yield await { name: 'A' };
  //   yield await { name: 'B' };
  //   yield await { name: 'C' };
  // };

  // console.log('----- Sending client stream... -----');

  // // Send a client stream and print the response
  // const clientStreamResponse = await client.sayHelloClient(clientGenerator);
  // console.log('Client stream response: ', clientStreamResponse, '\n\n');

  // console.log('----- Receiving server stream... -----');

  // // Receive a server stream and print each payload
  // for await (const payload of await client.sayHelloServer({ name: 'World' })) {
  //   console.log('Server stream payload: ', payload);
  // }
  // console.log('\n\nServer stream complete\n\n');

  // console.log('----- Sending duplex stream... -----');

  // // Send and receive a duplex stream, printing each payload
  // for await (const payload of await client.sayHelloDuplex(clientGenerator)) {
  //   console.log('Duplex stream payload: ', payload);
  // }
  // console.log('\n\nDuplex stream complete');
}

window.addEventListener('load', () => {
  main().then(console.log).catch(console.error)
})
