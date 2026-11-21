import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const port = Number(process.env.PORT || 3000);
const root = resolve(process.cwd());
const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGE_CHARS = 16_000;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};
const identity = `Te llamas VIRON (se pronuncia "Viron") y eres un tutor técnico profesional. Tu creador y programador es Fagioli Ruiz Lautaro Joel. Si te preguntan quién te creó o programó, responde que fue Fagioli Ruiz Lautaro Joel. El proyecto está hecho con HTML (index.html), CSS (styles.css), JavaScript para la interfaz y la lógica del asistente (app.js), y Node.js/JavaScript para el servidor (server.mjs); existe además una versión alternativa para Cloudflare Workers (cloudflare-worker.js). No inventes otros creadores ni tecnologías. Sigue la instrucción de idioma incluida en el mensaje; si no se indica idioma, responde en español rioplatense con tono sereno, breve y preciso. Enseña matemáticas avanzadas, inglés, química, física y materias técnicas con razonamiento paso a paso, verifica resultados y adapta la explicación al nivel. No inventes datos ni afirmes haber ejecutado acciones que no ejecutaste. Para acciones sensibles, pide confirmación.`;

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('PAYLOAD_TOO_LARGE');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    const error = new Error('INVALID_JSON');
    error.status = 400;
    throw error;
  }
}

async function askOpenAI(message) {
  if (!process.env.OPENAI_API_KEY) throw new Error('CONFIGURATION_REQUIRED');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.JARVIS_MODEL || 'gpt-5', instructions: identity, input: message, store: false }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`AI_ERROR_${response.status}`);
  const data = await response.json();
  return data.output_text || 'No pude elaborar una respuesta, señor.';
}

async function askOllama(message) {
  const response = await fetch(process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.JARVIS_MODEL || 'qwen3:4b', stream: false, messages: [{ role: 'system', content: identity }, { role: 'user', content: message }] }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error('OLLAMA_NOT_AVAILABLE');
  const data = await response.json();
  return data.message?.content || 'No pude elaborar una respuesta, señor.';
}

async function askGemini(message) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_KEY_REQUIRED');
  const model = process.env.JARVIS_MODEL || 'gemini-2.5-flash-lite';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: identity }] }, contents: [{ role: 'user', parts: [{ text: message }] }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (response.status === 429) throw new Error('GEMINI_FREE_LIMIT_REACHED');
  if (!response.ok) throw new Error(`GEMINI_ERROR_${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim() || 'No pude elaborar una respuesta, señor.';
}

async function askJarvis(message) {
  const provider = (process.env.JARVIS_PROVIDER || 'gemini').toLowerCase();
  if (provider === 'openai') return askOpenAI(message);
  if (provider === 'ollama') return askOllama(message);
  if (provider === 'gemini') return askGemini(message);
  throw new Error('PROVIDER_NOT_SUPPORTED');
}

const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Frame-Options', 'DENY');
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/api/health') {
      if (request.method !== 'GET') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });
      const provider = (process.env.JARVIS_PROVIDER || 'gemini').toLowerCase();
      const configured = provider === 'gemini' ? Boolean(process.env.GEMINI_API_KEY)
        : provider === 'openai' ? Boolean(process.env.OPENAI_API_KEY)
        : provider === 'ollama';
      return sendJson(response, 200, { status: configured ? 'operational' : 'configuration_required', service: 'viron', provider, aiConfigured: configured });
    }
    if (url.pathname === '/api/assistant') {
      if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });
      if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) return sendJson(response, 415, { error: 'JSON_REQUIRED' });
      const { message } = await readJson(request);
      if (typeof message !== 'string' || !message.trim()) return sendJson(response, 400, { error: 'BAD_REQUEST' });
      if (message.length > MAX_MESSAGE_CHARS) return sendJson(response, 413, { error: 'MESSAGE_TOO_LONG' });
      return sendJson(response, 200, { reply: await askJarvis(message.trim()) });
    }
    if (url.pathname.startsWith('/api/')) return sendJson(response, 404, { error: 'NOT_FOUND' });
    if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });

    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(`${root}${sep}`)) return sendJson(response, 404, { error: 'NOT_FOUND' });
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    if (request.method === 'HEAD') return response.end();
    response.end(content);
  } catch (error) {
    const status = error.status || (['CONFIGURATION_REQUIRED', 'GEMINI_KEY_REQUIRED', 'OLLAMA_NOT_AVAILABLE'].includes(error.message) ? 503 : error.message === 'GEMINI_FREE_LIMIT_REACHED' ? 429 : error.message.startsWith('AI_ERROR_') || error.message.startsWith('GEMINI_ERROR_') ? 502 : error.message === 'PROVIDER_NOT_SUPPORTED' ? 500 : error.name === 'TimeoutError' ? 504 : 404);
    sendJson(response, status, { error: status === 404 ? 'NOT_FOUND' : error.message || 'SERVER_ERROR' });
  }
});

server.listen(port, () => console.log(`V.I.R.O.N. listo en http://localhost:${port}`));






