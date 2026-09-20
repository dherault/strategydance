import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
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
