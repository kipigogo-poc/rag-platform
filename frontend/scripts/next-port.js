#!/usr/bin/env node
/**
 * Finds the next available port starting from PORT (default 3000) and
 * launches `next dev` or `next start` on that port.
 *
 * Usage (via package.json scripts):
 *   node scripts/next-port.js dev
 *   node scripts/next-port.js start
 */

const { createServer } = require('net');
const { spawn } = require('child_process');

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });
}

async function findAvailablePort(start) {
  let port = start;
  while (!(await isPortAvailable(port))) {
    console.warn(`\x1b[33m⚠  Port ${port} is in use, trying ${port + 1}…\x1b[0m`);
    port++;
  }
  return port;
}

async function main() {
  const cmd = process.argv[2] ?? 'dev';
  const startPort = parseInt(process.env.PORT ?? '3000', 10);
  const port = await findAvailablePort(startPort);

  if (port !== startPort) {
    console.log(`\x1b[36mℹ  Starting on port ${port} (${startPort} was unavailable)\x1b[0m`);
  }

  const child = spawn(
    'npx',
    ['next', cmd, '--port', String(port)],
    { stdio: 'inherit', shell: true },
  );

  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
