import { glob } from 'glob'
import { resolve } from 'path'
import fs from 'fs'
import { PixelIt } from './src/PixelIt'
import { loadImage } from 'canvas'

const assets = await glob('assets/**/*.png')

const skiplist = ['floor', 'corrupted', 'block']

async function build() {
  fs.mkdirSync(resolve(process.cwd(), 'dist/assets'), { recursive: true })
  for await (const filename of assets) {
    const from = await loadImage(resolve(process.cwd(), filename))
    const skipPixelate = skiplist.some(name => filename.includes(name))
    const pixel = new PixelIt({
      from,
      scale: 8,
      palette: [],
      maxHeight: 96,
      maxWidth: 96
    })
    const paths = filename.split('/')
    const name = paths[paths.length - 1]
    const img = pixel.draw()
    if (!skipPixelate) img.pixelate()
    img.resizeImage()
    fs.writeFileSync(`./dist/assets/${name}`, img.saveImage())
  }
}

build()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
