import path from 'node:path';
import { defineConfig } from 'vite';
import browserExtension from 'vite-plugin-web-extension';

function root(...paths: string[]): string {
  return path.resolve(__dirname, ...paths);
}

export default defineConfig({
  root: 'src',
  build: {
    outDir: root('dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@deadnet/bebop': '../bebop/lib/index.ts',
    },
  },
  plugins: [
    browserExtension({
      manifest: 'manifest.json',
      additionalInputs: [
        'content-scripts/script/index.ts',
        'another-page/index.html',
      ],
      watchFilePaths: [root('src/manifest.json')],
      browser: process.env.TARGET || 'chrome',
    }),
  ],
});
