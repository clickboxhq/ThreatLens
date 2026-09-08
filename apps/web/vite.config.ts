// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Originally built for Lovable's own Cloudflare Workers hosting (this package's default
  // preset). ThreatLens deploys the web app two ways, so the Nitro output preset follows the
  // build environment:
  //   - Railway (apps/web/Dockerfile.prod, GitHub Actions, local): a plain Docker image / long-
  //     lived Node process — `node-server`, which writes `.output/server/index.mjs`.
  //   - Vercel (git-connected project, Framework Preset "TanStack Start"): the platform sets
  //     `VERCEL=1` during every build — `vercel`, which writes Vercel's Build Output API tree.
  // Nothing outside Vercel ever sets `VERCEL`, so the Railway path is unchanged.
  nitro: { preset: process.env.VERCEL ? "vercel" : "node-server" },
});
