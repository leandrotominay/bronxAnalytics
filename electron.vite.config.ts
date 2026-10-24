import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const localOrtAssetNames = new Set([
  'ort.min.mjs',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm'
])
const rendererAssetFileNames = (assetInfo: { name?: string }): string =>
  assetInfo.name && localOrtAssetNames.has(assetInfo.name)
    ? `assets/${assetInfo.name}`
    : 'assets/[name]-[hash][extname]'

export default defineConfig({
  main: {
    define: {
      __BRONX_RIOT_SYNC_URL__: JSON.stringify(process.env.BRONX_RIOT_SYNC_URL ?? '')
    },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        },
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs'
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    optimizeDeps: {
      exclude: ['pocket-tts-js']
    },
    worker: {
      format: 'es',
      rollupOptions: {
        output: {
          assetFileNames: rendererAssetFileNames
        }
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay.html')
        },
        output: {
          assetFileNames: rendererAssetFileNames
        }
      }
    }
  }
})
