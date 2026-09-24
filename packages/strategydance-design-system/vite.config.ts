import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // The React compiler memoizes components automatically, via oxc rather than babel
    react({ compiler: true }),
  ],
})
