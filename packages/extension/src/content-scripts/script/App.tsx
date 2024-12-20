import { type PointLike, Texture, type Ticker, Assets as pxAssets } from 'pixi-unsafe'
import { For } from 'solid-js'
import { Application, Assets, Container, Sprite, useApplication } from 'solid-pixi-unsafe'

function BunniesContainer() {
  const app = useApplication()
  const texture = Texture.from('https://pixijs.com/assets/bunny.png')
  return (
    <Container
      x={app!.screen.width / 2}
      y={app!.screen.height / 2}
      ref={container => {
        container.pivot = { x: 100, y: 100 }
        const handler = (delta: Ticker) => {
          // rotate the container!
          // use delta to create frame-independent transform
          container.rotation -= 0.001 * delta.deltaMS
        }
        app!.ticker.add(handler)

        return () => {
          app!.ticker.remove(handler)
        }
      }}
    >
      <For each={Array.from({ length: 25 })} fallback={<></>}>
        {(_, i) => (
          <Sprite
            texture={texture}
            anchor={{ x: 0.5, y: 0.5 } as PointLike}
            x={(i() % 5) * 40}
            y={Math.floor(i() / 5) * 40}
          />
        )}
      </For>
    </Container>
  )
}

export function App() {
  return (
    <Application background="#1099bb" resizeTo={window}>
      <Assets load={[['https://pixijs.com/assets/bunny.png']]}>
        <BunniesContainer />
      </Assets>
    </Application>
  )
}
