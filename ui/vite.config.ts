import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(root, "..");
const require = createRequire(join(pkgRoot, "package.json"));

/** Vite 8 Rolldown leaves these as bare imports when `root` is `ui/` (deps live in the parent). The browser cannot resolve them → blank page with CSS only. */
function resolveParentNodeModules(): Plugin {
  const ids = [
    "prism-react-renderer",
    "@xterm/xterm",
    "@xterm/addon-fit",
    "@xterm/xterm/css/xterm.css",
  ];
  return {
    name: "snowshoe-resolve-parent-node-modules",
    enforce: "pre",
    resolveId(id) {
      if (!ids.includes(id)) return null;
      return require.resolve(id);
    },
  };
}

export default defineConfig({
  plugins: [resolveParentNodeModules(), react()],
  root,
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3232",
    },
  },
});
