import express from 'express';
import Typesense from 'typesense';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT) || 3000;
const tsTimeout = Number(process.env.TYPESENSE_TIMEOUT_SECONDS || 10);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Typesense.Client({
  nodes: [
    { host: process.env.TYPESENSE_HOST || 'localhost', port: Number(process.env.TYPESENSE_PORT) || 8108, protocol: process.env.TYPESENSE_PROTOCOL || 'http' }
  ],
  apiKey: process.env.TYPESENSE_API_KEY || 'xyz',
  connectionTimeoutSeconds: tsTimeout
});

app.get('/health', async (_req, res) => {
  try {
    const health = await client.health.retrieve();
    res.json(health);
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});

// Public config for browser-based frontends (no secrets!).
app.get('/config.json', (req, res) => {
  const host = process.env.TYPESENSE_HOST || req.hostname || 'localhost';
  const port = Number(process.env.TYPESENSE_PORT) || 8108;
  const protocol = process.env.TYPESENSE_PROTOCOL || 'http';
  const searchKey = process.env.TYPESENSE_SEARCH_KEY || '';
  res.json({ host, port, protocol, searchKey });
});

// Serve the two demo frontends for convenience
app.get('/public/conv', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public_conv_fetch.html'));
});
app.get('/public/instant', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public_instantsearch.html'));
});

// Remove legacy demo routes; keep only config, static demo pages, and proxy endpoints

// Same-origin proxy for multi_search to avoid browser CORS issues
app.post('/proxy/multi_search', express.json(), async (req, res) => {
  const host = (req.query.host || process.env.TYPESENSE_HOST || 'localhost').toString();
  const port = Number(req.query.port || process.env.TYPESENSE_PORT || 8108);
  const protocol = (req.query.protocol || process.env.TYPESENSE_PROTOCOL || 'http').toString();
  const apiKey = req.header('X-TYPESENSE-API-KEY') || process.env.TYPESENSE_API_KEY || 'xyz';

  const q = (req.query.q || '').toString();
  const conversation = (req.query.conversation || 'true').toString();
  const conversation_stream = (req.query.conversation_stream || 'false').toString();
  const conversation_model_id = (req.query.conversation_model_id || process.env.CONV_MODEL_ID || 'conv-model-1').toString();
  const prefix = (req.query.prefix || 'false').toString();
  const conversation_id = (req.query.conversation_id || '').toString();

  const baseUrl = `${protocol}://${host}:${port}`;
  const encodePlus = (s) => encodeURIComponent(s).replace(/%20/g, '+');
  const url = `${baseUrl}/multi_search?q=${encodePlus(q)}&conversation=${encodePlus(conversation)}&conversation_stream=${encodePlus(conversation_stream)}&conversation_model_id=${encodePlus(conversation_model_id)}&prefix=${encodePlus(prefix)}${conversation_id ? `&conversation_id=${encodePlus(conversation_id)}` : ''}`;

  try {
    const tsRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TYPESENSE-API-KEY': apiKey
      },
      body: JSON.stringify(req.body)
    });
    const text = await tsRes.text();
    res.status(tsRes.status).type(tsRes.headers.get('content-type') || 'application/json').send(text);
  } catch (error) {
    res.status(502).json({ error: error?.message || String(error) });
  }
});

// Same-origin helper: POST /multi_search → forwards to upstream Typesense from env
app.post('/multi_search', express.json(), async (req, res) => {
  const upstreamHost = (process.env.TYPESENSE_UPSTREAM_HOST || process.env.TYPESENSE_HOST || '127.0.0.1').toString();
  const upstreamPort = Number(process.env.TYPESENSE_UPSTREAM_PORT || process.env.TYPESENSE_PORT || 8108);
  const upstreamProtocol = (process.env.TYPESENSE_UPSTREAM_PROTOCOL || process.env.TYPESENSE_PROTOCOL || 'http').toString();
  const apiKey = req.header('X-TYPESENSE-API-KEY') || process.env.TYPESENSE_API_KEY || 'xyz';

  const q = (req.query.q || '').toString();
  const conversation = (req.query.conversation || 'true').toString();
  const conversation_stream = (req.query.conversation_stream || 'false').toString();
  const conversation_model_id = (req.query.conversation_model_id || process.env.CONV_MODEL_ID || 'conv-model-1').toString();
  const prefix = (req.query.prefix || 'false').toString();
  const conversation_id = (req.query.conversation_id || '').toString();

  const encodePlus = (s) => encodeURIComponent(s).replace(/%20/g, '+');
  const baseUrl = `${upstreamProtocol}://${upstreamHost}:${upstreamPort}`;
  const url = `${baseUrl}/multi_search?q=${encodePlus(q)}&conversation=${encodePlus(conversation)}&conversation_stream=${encodePlus(conversation_stream)}&conversation_model_id=${encodePlus(conversation_model_id)}&prefix=${encodePlus(prefix)}${conversation_id ? `&conversation_id=${encodePlus(conversation_id)}` : ''}`;

  try {
    const tsRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TYPESENSE-API-KEY': apiKey },
      body: JSON.stringify(req.body)
    });
    const text = await tsRes.text();
    res.status(tsRes.status).type(tsRes.headers.get('content-type') || 'application/json').send(text);
  } catch (error) {
    res.status(502).json({ error: error?.message || String(error) });
  }
});

// Streaming conversation SSE proxy: GET /api/conv/stream?q=...&conversation_id=...
app.get('/api/conv/stream', async (req, res) => {
  const upstreamHost = (process.env.TYPESENSE_UPSTREAM_HOST || process.env.TYPESENSE_HOST || '127.0.0.1').toString();
  const upstreamPort = Number(process.env.TYPESENSE_UPSTREAM_PORT || process.env.TYPESENSE_PORT || 8108);
  const upstreamProtocol = (process.env.TYPESENSE_UPSTREAM_PROTOCOL || process.env.TYPESENSE_PROTOCOL || 'http').toString();
  const apiKey = req.header('X-TYPESENSE-API-KEY') || process.env.TYPESENSE_API_KEY || 'xyz';

  const q = (req.query.q || '').toString();
  const conversation_id = (req.query.conversation_id || '').toString();
  const conversation_model_id = (req.query.conversation_model_id || process.env.CONV_MODEL_ID || 'conv-model-1').toString();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const encodePlus = (s) => encodeURIComponent(s).replace(/%20/g, '+');
  const baseUrl = `${upstreamProtocol}://${upstreamHost}:${upstreamPort}`;
  const url = `${baseUrl}/multi_search?q=${encodePlus(q)}&conversation=true&conversation_stream=true&conversation_model_id=${encodePlus(conversation_model_id)}${conversation_id ? `&conversation_id=${encodePlus(conversation_id)}` : ''}&prefix=false`;

  const body = JSON.stringify({
    searches: [
      { collection: 'seating', query_by: 'embedding', exclude_fields: 'embedding' }
    ]
  });

  const controller = new AbortController();
  const onClose = () => { try { controller.abort(); } catch (_) {} };
  req.on('close', onClose);

  try {
    const tsRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TYPESENSE-API-KEY': apiKey },
      body,
      signal: controller.signal
    });

    if (!tsRes.ok || !tsRes.body) {
      const errText = await tsRes.text().catch(() => '');
      res.write(`data: ${JSON.stringify({ error: `Upstream error ${tsRes.status}`, details: errText })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const reader = tsRes.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        res.write(decoder.decode(value));
      }
    }
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: String(error && error.message || error) })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } finally {
    req.off('close', onClose);
  }
});
app.get('/', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Conversational Search</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; margin: 2rem; }
    .row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    input, button { font-size: 16px; padding: 0.5rem; }
    .muted { color: #666; font-size: 0.9em; }
    img.thumb { width: 72px; height: 72px; object-fit: cover; border-radius: 6px; vertical-align: middle; margin: 0.25rem 0; }
  </style>
  </head>
  <body>
    <h1>Conversational Search</h1>
    <div class="row">
      <input id="chat_q" placeholder="Ask a question" size="40" />
      <button id="chat_go">Ask</button>
      <button id="chat_reset">Reset conversation</button>
    </div>
    <div id="chat_stream" class="muted" style="white-space: pre-wrap; margin-top: 0.5rem"></div>
    <div id="chat_id" class="muted" style="margin-top: 0.25rem"></div>
    <script>
      const chatQ = document.getElementById('chat_q');
      const chatGo = document.getElementById('chat_go');
      const chatReset = document.getElementById('chat_reset');
      const chatStream = document.getElementById('chat_stream');
      const chatId = document.getElementById('chat_id');
      let conversationId = undefined;
      let es = undefined;
      let buffer = '';

      function closeStream() { if (es) { es.close(); es = undefined; } }

      function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      function renderMarkdownLite(md) {
        const escaped = escapeHtml(md || '');
        const withImgs = escaped.replace(/!\\[([^\\]]*)\\]\\((https?:[^)\\s]+\\.(?:jpg|jpeg|png|gif|webp)[^)]*)\\)/gi, (_m, alt, url) => {
          const safeAlt = String(alt || '').replace(/\"/g, '&quot;');
          return '<img class="thumb" src="' + url + '" alt="' + safeAlt + '" loading="lazy" />';
        });
        const withLinks = withImgs.replace(/\\[([^\\]]+)\\]\\((https?:[^)\\s]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1<\/a>');
        const withBold = withLinks.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1<\/strong>');
        // Strip common bullet prefixes at line start: hyphen, en dash, em dash, bullet
        const withoutDash = withBold.replace(/^\s*[-–—•]\s+/gm, '');
        return withoutDash.replace(/\\n/g, '<br>');
      }

      async function startChat() {
        const q = chatQ.value.trim();
        if (!q) return;
        closeStream();
        buffer = '';
        chatStream.innerHTML = '';
        const params = new URLSearchParams({ q });
        if (conversationId) params.set('conversation_id', conversationId);
        es = new EventSource('/api/conv/stream?' + params.toString());
        es.onmessage = (ev) => {
          if (ev.data === '[DONE]') { closeStream(); return; }
          let appended = false;
          let parsedOk = false;
          try {
            const parsed = JSON.parse(ev.data);
            parsedOk = true;
            if (parsed?.message) { buffer += parsed.message; appended = true; }
            if (parsed?.conversation?.message) { buffer += parsed.conversation.message; appended = true; }
            if (parsed?.conversation?.answer) { buffer += (buffer ? '\\n' : '') + parsed.conversation.answer; appended = true; }
            const cid = parsed?.conversation_id || parsed?.conversation?.conversation_id;
            if (cid) { conversationId = cid; chatId.textContent = 'conversation_id: ' + conversationId; }
            if (parsed?.error) { buffer += '\\n[error] ' + String(parsed.error) + (parsed?.details ? ' - ' + String(parsed.details) : '') + '\\n'; appended = true; }
          } catch (_) { /* not JSON */ }
          if (!parsedOk && ev.data) { buffer += ev.data; }
          if (appended || !parsedOk) { chatStream.innerHTML = renderMarkdownLite(buffer); }
        };
        es.onerror = () => { chatStream.textContent += '\\n[stream error]\\n'; closeStream(); };
      }

      chatGo.addEventListener('click', startChat);
      chatQ.addEventListener('keydown', (e) => { if (e.key === 'Enter') startChat(); });
      chatReset.addEventListener('click', () => { conversationId = undefined; chatId.textContent = ''; chatStream.textContent = ''; });
    </script>
  </body>
  </html>`);
});

app.listen(port, () => {
  console.log(`Search UI running on http://localhost:${port}`);
});


