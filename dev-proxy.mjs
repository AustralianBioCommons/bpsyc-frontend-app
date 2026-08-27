import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const TARGET = process.env.DEV_PROXY_TARGET ?? 'https://bpsyc.test.biocommons.org.au';
// 8080 is often taken (e.g. Docker Desktop port-forwards); override with DEV_PROXY_PORT.
// NEXT_PUBLIC_GEN3_API_TARGET in .env.development must point at the same port.
const PORT = Number(process.env.DEV_PROXY_PORT ?? 8081);

const targetHost = new URL(TARGET).hostname;

const server = http.createServer((clientReq, clientRes) => {
  const url = new URL(clientReq.url, TARGET);

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: clientReq.method,
    headers: {
      ...clientReq.headers,
      host: targetHost,
    },
  };

  // Remove headers that cause issues
  delete options.headers['connection'];

  const proxyReq = https.request(options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    clientRes.writeHead(502);
    clientRes.end('Proxy error');
  });

  clientReq.pipe(proxyReq, { end: true });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use (lsof -nP -iTCP:${PORT} -sTCP:LISTEN to see by what).\n` +
        `Pick another port: DEV_PROXY_PORT=8082 node dev-proxy.mjs\n` +
        `and set NEXT_PUBLIC_GEN3_API_TARGET=http://localhost:8082 in .env.development to match.`,
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`Dev proxy running on http://localhost:${PORT} -> ${TARGET}`);
});
