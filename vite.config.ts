// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const nitroPreset = process.env.NITRO_PRESET || "node-server";

export default defineConfig({
  nitro: {
    preset: nitroPreset,
    // Netlify functions must be self-contained. Keep runtime dependencies bundled.
    ...({ noExternals: true } as Record<string, unknown>),
  },
  vite: {
    resolve: {
      // tslib's CommonJS entry is miscompiled by the Netlify bundle step.
      // Its official ESM build avoids that interop path.
      alias: { tslib: "tslib/tslib.es6.mjs" },
    },
    // Transform server dependencies before Nitro bundles them. Some ESM packages
    // (including Radix and Supabase) otherwise resolve their CommonJS fallbacks
    // as missing default exports in Netlify's server runtime.
    ssr: {
      noExternal: true,
    },
    server: {
      allowedHosts: [".loca.lt", ".ngrok-free.app"],
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
