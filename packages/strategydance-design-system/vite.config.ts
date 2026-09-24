import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const source = fileURLToPath(new URL('./src', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    // Mirrors `paths` in tsconfig.app.json
    alias: [
      { find: /^strategydance-design-system\//, replacement: `${source}/` },
    ],
  },
  plugins: [
    tailwindcss(),
    // The React compiler memoizes components automatically, via oxc rather than babel
    react({ compiler: true }),
  ],
})
