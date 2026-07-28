import { fileURLToPath, URL } from "node:url";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { writeSeoStaticPages } from "./scripts/generate-seo-pages.mjs";

function sitesStaticWorker() {
  let root = process.cwd();

  return {
    name: "tawaf-sites-static-worker",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const serverDirectory = resolve(root, "dist", "server");
      const metadataDirectory = resolve(root, "dist", ".openai");
      await mkdir(serverDirectory, { recursive: true });
      await mkdir(metadataDirectory, { recursive: true });
      await cp(
        resolve(root, ".openai", "hosting.json"),
        resolve(metadataDirectory, "hosting.json"),
      );
      await writeFile(
        resolve(serverDirectory, "index.js"),
        `const worker = {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if ((request.method === "GET" || request.method === "HEAD") && response.status === 404) {
      const indexUrl = new URL("/index.html", request.url);
      return env.ASSETS.fetch(new Request(indexUrl, request));
    }
    return response;
  },
};

export default worker;
`,
      );
      await writeSeoStaticPages(resolve(root, "dist"));
    },
  };
}

export default defineConfig({
  plugins: [react(), sitesStaticWorker()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
