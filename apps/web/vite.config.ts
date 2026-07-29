import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Docker Desktop on Windows doesn't propagate native filesystem change events
    // across the bind mount into the container, so Vite's watcher never fires without
    // polling (§19.7 — dev must behave the same as it will in any other Docker Compose
    // environment, so this is a real fix, not a workaround to remove later).
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})
