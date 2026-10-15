/**
 * The mock sandbox's own dev server (sandbox/README.md): npm run mock:serve
 * Vite with the project's config (HMR; a new sandbox/mocks/*.svelte shows up by itself), on
 * MOCK_PORT (default 5199, away from the ports npm run dev picks: 5173, 5174, …), and prints the viewer's URL.
 * Plain Node, no shell: the same on Windows, macOS and Linux.
 */
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const port = Number(process.env.MOCK_PORT || 5199);
const server = await createServer({
  root,
  configFile: path.join(root, 'vite.config.js'),
  server: { port, strictPort: true },
  clearScreen: false,
});
await server.listen();
const local = server.resolvedUrls?.local?.[0] || `http://localhost:${port}/`;
console.log(`\n  Mock sandbox: ${new URL('edit/sandbox/', local)}\n`);
