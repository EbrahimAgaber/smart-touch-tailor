// wait-vite.cjs
// Polls tcp://127.0.0.1:5173 until it accepts connections, then exits 0.
// Used instead of wait-on to avoid IPv4/IPv6 ambiguity on Windows.
const net = require('net');
const MAX_WAIT_MS = 60000;
const INTERVAL_MS = 400;
const HOST = '127.0.0.1';
const PORT = 5173;

const start = Date.now();

function probe() {
  const sock = new net.Socket();
  sock.setTimeout(500);
  sock.on('connect', () => {
    sock.destroy();
    process.exit(0);
  });
  sock.on('error', retry);
  sock.on('timeout', retry);
  sock.connect(PORT, HOST);

  function retry() {
    sock.destroy();
    if (Date.now() - start > MAX_WAIT_MS) {
      console.error(`[wait-vite] Timed out after ${MAX_WAIT_MS}ms waiting for ${HOST}:${PORT}`);
      process.exit(1);
    }
    setTimeout(probe, INTERVAL_MS);
  }
}

console.log(`[wait-vite] Waiting for ${HOST}:${PORT} ...`);
probe();
