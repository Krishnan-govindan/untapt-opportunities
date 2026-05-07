// Vercel Node.js serverless function — bridges Web Request/Response to TanStack Start's fetch handler
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, '../dist/server/server.js');

let _server;
async function getServer() {
  if (!_server) {
    const mod = await import(pathToFileURL(serverPath).href);
    _server = mod.default;
  }
  return _server;
}

export default async function handler(req, res) {
  const protocol = req.headers['x-forwarded-proto'] ?? 'https';
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url, `${protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value != null) {
      headers.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
  }

  let body = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
    if (body.length === 0) body = undefined;
  }

  const webReq = new Request(url.toString(), {
    method: req.method,
    headers,
    body,
    ...(body ? { duplex: 'half' } : {}),
  });

  const server = await getServer();
  const webRes = await server.fetch(webReq, process.env, {});

  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => res.setHeader(key, value));

  if (!webRes.body) {
    res.end();
    return;
  }

  const reader = webRes.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) {
        await new Promise((r) => res.once('drain', r));
      }
    }
  } finally {
    res.end();
  }
}

export const config = {
  maxDuration: 60,
};
