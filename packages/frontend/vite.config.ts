import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const source = fileURLToPath(new URL('./src', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    // Mirrors `paths` in tsconfig.json. An array of anchored regexes rather than the object
    // form, because a string `find` matches any id merely starting with it, which would send
    // `~typesomething` to src/types.ts
    alias: [
      { find: /^~components\//, replacement: `${source}/components/` },
      { find: /^~contexts\//, replacement: `${source}/contexts/` },
      { find: /^~data\//, replacement: `${source}/data/` },
      { find: /^~hooks\//, replacement: `${source}/hooks/` },
      { find: /^~utils\//, replacement: `${source}/utils/` },
      { find: /^~constants$/, replacement: `${source}/constants.ts` },
      { find: /^~types$/, replacement: `${source}/types.ts` },
    ],
  },
  plugins: [
    tailwindcss(),
    // SPA mode: the server prerenders the document shell at build time and the
    // app itself renders on the client only
    tanstackStart({
      spa: {
        enabled: true,
      },
    }),
    // The React compiler memoizes components automatically, via oxc rather than babel
    react({ compiler: true }),
  ],
})
