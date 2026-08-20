import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";

/**
 * Extensions that exist in a book bundle for provenance and hand-off, but that
 * the Reader never fetches: the immutable TXT/EPUB original and the production
 * notes. `publicDir` copies the library verbatim, so the build prunes them
 * instead of shipping them to every visitor.
 */
const NON_RUNTIME_EXTENSIONS = [".epub", ".txt", ".md"];

function pruneNonRuntimeBookFiles(): Plugin {
  return {
    name: "prune-non-runtime-book-files",
    apply: "build",
    closeBundle: {
      sequential: true,
      handler() {
        const outDir = join(import.meta.dirname, "dist");
        let pruned = 0;
        let bytes = 0;

        const walk = (directory: string) => {
          for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) {
              walk(path);
              continue;
            }
            if (!NON_RUNTIME_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
              continue;
            }
            bytes += statSync(path).size;
            pruned += 1;
            rmSync(path);
            this.info(`pruned ${relative(outDir, path)}`);
          }
        };

        walk(outDir);
        if (pruned > 0) {
          this.info(
            `pruned ${pruned} non-runtime file(s), ${Math.round(bytes / 1024)} kB`,
          );
        }
      },
    },
  };
}

/**
 * Progressive-web-app shell, build only.
 *
 * `publicDir` points at the book library, so the manifest, icon, and service
 * worker cannot live there; this emits them from `pwa/` into the bundle and
 * injects the manifest link. The service worker is registered by main.tsx in
 * production builds only, so dev keeps its plain unregistered behaviour.
 */
function readerPwa(): Plugin {
  const pwaDir = join(import.meta.dirname, "pwa");
  return {
    name: "reader-pwa",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "</head>",
        '  <link rel="manifest" href="/manifest.webmanifest" />\n  </head>',
      );
    },
    generateBundle() {
      const stamp = Date.now().toString(36);
      this.emitFile({
        type: "asset",
        fileName: "manifest.webmanifest",
        source: readFileSync(join(pwaDir, "manifest.webmanifest"), "utf-8"),
      });
      this.emitFile({
        type: "asset",
        fileName: "icon.svg",
        source: readFileSync(join(pwaDir, "icon.svg"), "utf-8"),
      });
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: readFileSync(join(pwaDir, "sw.js"), "utf-8").replace(
          "__BUILD_STAMP__",
          stamp,
        ),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), pruneNonRuntimeBookFiles(), readerPwa()],
  publicDir: "../../books",
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
