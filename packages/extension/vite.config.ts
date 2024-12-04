import path from 'node:path';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import browserExtension from 'vite-plugin-web-extension';
// import { viteStaticCopy } from 'vite-plugin-static-copy'

const standalone = process.env.STANDALONE

function root(...paths: string[]): string {
  return path.resolve(__dirname, ...paths);
}

export default defineConfig({
  root: 'src',
  build: {
    target: 'esnext',
    outDir: root('dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@deadnet/bebop/bebop': path.resolve(process.cwd(), '../bebop/lib/bebop.ts'),
      '@deadnet/bebop/extensionChannel': path.resolve(process.cwd(), '../bebop/lib/extensionChannel.ts'),
      '@deadnet/bebop/wsChannel': path.resolve(process.cwd(), '../bebop/lib/wsChannel.ts'),
    }
  },
  plugins: [
    ...(!standalone ? [browserExtension({
      manifest: 'manifest.json',
      additionalInputs: [
        'content-scripts/script/index.tsx',
        'another-page/index.html',
      ],
      watchFilePaths: [root('src/manifest.json')],
      browser: process.env.TARGET || 'chrome',
    })] : []),
    solidPlugin(),
  ],
});
