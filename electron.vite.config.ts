import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const rendererAssetFileNames = (assetInfo: { name?: string }): string =>
  assetInfo.name?.includes('ort-wasm-simd.wasm')
    ? 'assets/ort-wasm-simd.wasm'
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
