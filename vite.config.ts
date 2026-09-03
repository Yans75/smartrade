import { loadEnv, mergeConfig, defineConfig as defineViteConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Standalone equivalent of the Lovable-managed vite config this project used
// to depend on. Kept deliberately close to what it produced outside sandbox
// mode: same plugin set, same cloudflare-module build target, same alias and
// dedupe rules — minus the Lovable sandbox/preview-only branches.
export default defineViteConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return mergeConfig(
    {
      define: envDefine,
      css: { transformer: "lightningcss" },
      resolve: {
        alias: { "@": `${process.cwd()}/src` },
        dedupe: [
          "react",
          "react-dom",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "@tanstack/react-query",
          "@tanstack/query-core",
        ],
      },
      optimizeDeps: {
        include: [
          "react",
          "react-dom",
          "react-dom/client",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
        ],
        ignoreOutdatedRequests: true,
      },
      // Pas de host "::" (hérité du sandbox Lovable) : l'IPv6 n'est pas
      // disponible partout et l'échec est illisible. Vite écoute sur
      // localhost par défaut ; `--host` en ligne de commande si besoin
      // d'exposer le serveur de dev sur le réseau local.
      server: { port: 8080 },
      plugins: [
        tailwindcss(),
        tsConfigPaths({ projects: ["./tsconfig.json"] }),
        tanstackStart({
          importProtection: {
            behavior: "error",
            client: { files: ["**/server/**"], specifiers: ["server-only"] },
          },
          // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
          server: { entry: "server" },
        }),
        ...(command === "build" ? [nitro({ preset: "cloudflare-module" })] : []),
        viteReact(),
      ],
    },
    mode === "development" && command === "build"
      ? {
          environments: {
            client: { define: { "process.env.NODE_ENV": JSON.stringify("development") } },
          },
          esbuild: { keepNames: true },
        }
      : {},
  );
});
