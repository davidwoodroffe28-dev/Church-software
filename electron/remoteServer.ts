import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';
import QRCode from 'qrcode';
import type { ProgramState } from '@shared/types';

const PORT = 51830;

export type RemoteActionType = 'next' | 'prev' | 'black' | 'clear';

export interface RemoteStatus {
  running: boolean;
  url: string | null;
  qrDataUrl: string | null;
}

let server: http.Server | null = null;
let token = '';
let lanUrl: string | null = null;
let onAction: ((type: RemoteActionType) => void) | null = null;
let lastState: ProgramState = { current: { kind: 'blank' } };
const sseClients = new Set<http.ServerResponse>();

/** Standard private-LAN ranges, ranked above anything else (VPN/Tailscale/CGNAT addresses like
 *  100.64.0.0/10 are technically "non-internal" too, but a phone on the church's actual Wi-Fi can't
 *  reach those — picking one there would produce a QR code nobody nearby could connect to). */
function lanRank(ip: string): number {
  if (/^192\.168\./.test(ip)) return 0;
  if (/^10\./.test(ip)) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
  return 3;
}

function primaryLanAddress(): string | null {
  const nets = os.networkInterfaces();
  const candidates: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) candidates.push(net.address);
    }
  }
  candidates.sort((a, b) => lanRank(a) - lanRank(b));
  return candidates[0] ?? null;
}

function slideSummary(state: ProgramState) {
  const label = (s: ProgramState['current']) => s.text ?? s.label ?? (s.kind === 'blank' ? '' : s.kind);
  return {
    current: state.current.kind === 'blank' ? null : label(state.current),
    next: state.next ? label(state.next) : null,
    onAir: state.current.kind !== 'blank',
  };
}

function broadcast() {
  const payload = `data: ${JSON.stringify(slideSummary(lastState))}\n\n`;
  for (const res of sseClients) res.write(payload);
}

/** Called by main.ts whenever GoLive/ClearLive changes the program state, so the remote page's
 *  current/next preview stays in sync with the actual output. */
export function updateRemoteState(state: ProgramState) {
  lastState = state;
  broadcast();
}

function remotePageHtml(): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Sanctuary Remote</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; background: #16181c; color: #e9ebee; font-family: -apple-system, system-ui, sans-serif; min-height: 100vh; display: flex; flex-direction: column; padding: 16px; gap: 14px; }
  .status { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #8b939d; text-align: center; }
  .status.connected { color: #3fb6bf; }
  .panel { background: #1c1f24; border-radius: 14px; padding: 18px; }
  .tag { font-size: 10px; letter-spacing: .1em; color: #8b939d; margin-bottom: 6px; }
  .live .tag { color: #c9564f; }
  .text { font-size: 20px; line-height: 1.4; min-height: 1.4em; white-space: pre-wrap; }
  .next .text { font-size: 15px; color: #aab3bd; }
  .transport { display: flex; gap: 10px; }
  button { flex: 1; height: 64px; font-size: 16px; font-weight: 600; border-radius: 12px; border: 1px solid #30353d; background: #23272d; color: #e9ebee; }
  button:active { background: #282d34; }
  .row { display: flex; gap: 10px; }
  .row button { height: 52px; font-size: 13px; }
  .row button.active { background: #c9564f; border-color: #c9564f; color: #fff; }
</style>
</head>
<body>
  <div class="status" id="status">Connecting…</div>
  <div class="panel live">
    <div class="tag">ON AIR</div>
    <div class="text" id="current">—</div>
  </div>
  <div class="panel next">
    <div class="tag">NEXT</div>
    <div class="text" id="next">—</div>
  </div>
  <div class="transport">
    <button onclick="act('prev')">◀ Prev</button>
    <button onclick="act('next')">Next ▶</button>
  </div>
  <div class="row">
    <button id="black" onclick="act('black')">Black</button>
    <button id="clear" onclick="act('clear')">Clear</button>
  </div>
<script>
const token = new URLSearchParams(location.search).get('token') || '';
function act(type) {
  fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, token }) });
}
const es = new EventSource('/api/events?token=' + encodeURIComponent(token));
es.onopen = () => { document.getElementById('status').textContent = 'Connected'; document.getElementById('status').className = 'status connected'; };
es.onerror = () => { document.getElementById('status').textContent = 'Reconnecting…'; document.getElementById('status').className = 'status'; };
es.onmessage = (e) => {
  const s = JSON.parse(e.data);
  document.getElementById('current').textContent = s.current || (s.onAir ? '' : 'Nothing on air');
  document.getElementById('next').textContent = s.next || '—';
};
</script>
</body>
</html>`;
}

function checkToken(url: URL | null, body?: { token?: string }): boolean {
  const supplied = url?.searchParams.get('token') ?? body?.token ?? '';
  return supplied === token;
}

export function startRemoteServer(handleAction: (type: RemoteActionType) => void): RemoteStatus {
  if (server) return getRemoteStatus();
  onAction = handleAction;
  token = crypto.randomBytes(4).toString('hex');

  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (url.pathname === '/' && req.method === 'GET') {
      if (!checkToken(url)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Invalid or missing token.');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(remotePageHtml());
      return;
    }

    if (url.pathname === '/api/events' && req.method === 'GET') {
      if (!checkToken(url)) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify(slideSummary(lastState))}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    if (url.pathname === '/api/action' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          if (!checkToken(null, parsed)) {
            res.writeHead(403);
            res.end();
            return;
          }
          if (['next', 'prev', 'black', 'clear'].includes(parsed.type)) {
            onAction?.(parsed.type);
          }
          res.writeHead(204);
          res.end();
        } catch {
          res.writeHead(400);
          res.end();
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT);
  lanUrl = primaryLanAddress();
  return getRemoteStatus();
}

export function stopRemoteServer() {
  for (const res of sseClients) res.end();
  sseClients.clear();
  server?.close();
  server = null;
  onAction = null;
  lanUrl = null;
  token = '';
}

export async function getRemoteStatusWithQr(): Promise<RemoteStatus> {
  const status = getRemoteStatus();
  if (!status.url) return status;
  const qrDataUrl = await QRCode.toDataURL(status.url, { margin: 1, width: 240 });
  return { ...status, qrDataUrl };
}

function getRemoteStatus(): RemoteStatus {
  if (!server || !lanUrl) return { running: false, url: null, qrDataUrl: null };
  return { running: true, url: `http://${lanUrl}:${PORT}/?token=${token}`, qrDataUrl: null };
}
