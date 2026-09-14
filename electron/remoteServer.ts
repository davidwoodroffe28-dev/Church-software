import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';
import dgram from 'node:dgram';
import QRCode from 'qrcode';
import type { ProgramState } from '@shared/types';
import type { RemoteActionType, RemoteQueueItem } from '@shared/api';

export type { RemoteActionType, RemoteQueueItem } from '@shared/api';

const PORT = 51830;

export interface RemoteStatus {
  running: boolean;
  url: string | null;
  qrDataUrl: string | null;
}

let server: http.Server | null = null;
let token = '';
let lanUrl: string | null = null;
let onAction: ((type: RemoteActionType, itemId?: string) => void) | null = null;
let lastState: ProgramState = { current: { kind: 'blank' } };
let lastQueue: RemoteQueueItem[] = [];
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

// Virtual/tunnel adapters (VirtualBox, VMware, Hyper-V, VPN clients) very commonly bind their own
// address in a perfectly normal-looking private range — VirtualBox's host-only adapter defaults to
// 192.168.56.0/24, for instance — so range alone can't tell those apart from the real Wi-Fi/Ethernet
// adapter a phone can actually reach. This is only used as a fallback name filter; the primary
// method below asks the OS which interface it would actually route through instead of guessing.
const VIRTUAL_ADAPTER_NAME = /virtualbox|vmware|hyper-v|vethernet|virtual|tailscale|wireguard|nordlynx|tap-|tun\d|loopback|bluetooth/i;

function fallbackLanAddress(): string | null {
  const nets = os.networkInterfaces();
  const candidates: string[] = [];
  const fallbacks: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      (VIRTUAL_ADAPTER_NAME.test(name) ? fallbacks : candidates).push(net.address);
    }
  }
  const pick = candidates.length ? candidates : fallbacks;
  pick.sort((a, b) => lanRank(a) - lanRank(b));
  return pick[0] ?? null;
}

/** Asks the OS which local address it would route through to reach the internet — reliably the
 *  real LAN-facing adapter (Wi-Fi/Ethernet) regardless of what else is installed, since VPN/virtual
 *  adapters don't hold the default route. No packets actually need to reach 8.8.8.8; connect() on a
 *  UDP socket only triggers a local routing-table lookup. Falls back to the name-filtered range
 *  heuristic if that lookup fails outright (e.g. no network route at all). */
function primaryLanAddress(): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const done = (address: string | null) => {
      socket.close();
      resolve(address);
    };
    socket.once('error', () => done(fallbackLanAddress()));
    socket.connect(80, '8.8.8.8', () => {
      try {
        done(socket.address().address);
      } catch {
        done(fallbackLanAddress());
      }
    });
  });
}

function slideSummary(state: ProgramState) {
  const label = (s: ProgramState['current']) => s.text ?? s.label ?? (s.kind === 'blank' ? '' : s.kind);
  return {
    current: state.current.kind === 'blank' ? null : label(state.current),
    next: state.next ? label(state.next) : null,
    onAir: state.current.kind !== 'blank',
    // Black/Clear don't change `current` itself (the room's output is driven by these flags
    // independently) — without them the remote page had no way to show its Black/Clear buttons
    // were actually doing anything, which is exactly what read as "the buttons don't work".
    textVisible: state.textVisible ?? true,
    backgroundVisible: state.backgroundVisible ?? true,
    queue: lastQueue,
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

/** Called by main.ts whenever the schedule, staged item, or live item changes — independent of
 *  updateRemoteState, since staging an item (tapping it on the phone) doesn't touch the audience
 *  output at all until "Go Live" is pressed. */
export function updateRemoteQueue(items: RemoteQueueItem[]) {
  lastQueue = items;
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
  body { margin: 0; background: #16181c; color: #e9ebee; font-family: -apple-system, system-ui, sans-serif; min-height: 100vh; display: flex; flex-direction: column; padding: 16px; gap: 14px; padding-bottom: 90px; }
  .status { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #8b939d; text-align: center; }
  .status.connected { color: #1b75bb; }
  .panel { background: #1c1f24; border-radius: 14px; padding: 18px; }
  .tag { font-size: 10px; letter-spacing: .1em; color: #8b939d; margin-bottom: 6px; }
  .live .tag { color: #c9564f; }
  .text { font-size: 20px; line-height: 1.4; min-height: 1.4em; white-space: pre-wrap; transition: opacity 150ms ease; }
  .next .text { font-size: 15px; color: #aab3bd; }
  .transport { display: flex; gap: 10px; }
  button { flex: 1; height: 64px; font-size: 16px; font-weight: 600; border-radius: 12px; border: 1px solid #30353d; background: #23272d; color: #e9ebee; }
  button:active { background: #282d34; }
  .row { display: flex; gap: 10px; }
  .row button { height: 52px; font-size: 13px; }
  .row button.active { background: #c9564f; border-color: #c9564f; color: #fff; }
  .queue-panel { flex: 1; min-height: 120px; display: flex; flex-direction: column; padding: 12px; }
  .queue-list { overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
  .queue-empty { color: #6e7783; font-size: 13px; padding: 10px 6px; }
  .queue-row { padding: 12px 10px; border-radius: 10px; border: 1px solid transparent; font-size: 14px; }
  .queue-row-live { background: rgba(201, 86, 79, .16); border-color: #c9564f; }
  .queue-row-staged { background: rgba(27, 117, 187, .18); border-color: #1b75bb; }
  .queue-row-tag { font-size: 9px; letter-spacing: .08em; margin-left: 8px; opacity: .8; }
  .go-live-bar { position: fixed; left: 16px; right: 16px; bottom: 16px; }
  .go-live-bar button { width: 100%; height: 56px; background: #f6921e; border-color: #f6921e; color: #16181c; font-weight: 700; box-shadow: 0 4px 20px rgba(246,146,30,.4); }
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
  <div class="panel queue-panel">
    <div class="tag">QUEUE · TAP TO STAGE</div>
    <div class="queue-list" id="queue"></div>
  </div>
  <div class="go-live-bar" id="goLiveBar" style="display:none">
    <button onclick="act('goLive')" id="goLiveBtn">Go Live</button>
  </div>
<script>
const token = new URLSearchParams(location.search).get('token') || '';
function act(type, itemId) {
  fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, itemId, token }) });
}
function renderQueue(queue) {
  const el = document.getElementById('queue');
  el.innerHTML = '';
  if (!queue || !queue.length) {
    el.innerHTML = '<div class="queue-empty">Nothing scheduled.</div>';
  }
  let staged = null;
  (queue || []).forEach((item) => {
    const row = document.createElement('div');
    row.className = 'queue-row' + (item.isLive ? ' queue-row-live' : '') + (item.isStaged ? ' queue-row-staged' : '');
    row.textContent = item.label;
    if (item.isLive) {
      const tag = document.createElement('span');
      tag.className = 'queue-row-tag';
      tag.textContent = 'LIVE';
      row.appendChild(tag);
    }
    row.onclick = () => act('stage', item.id);
    el.appendChild(row);
    if (item.isStaged) staged = item;
  });
  const bar = document.getElementById('goLiveBar');
  if (staged) {
    bar.style.display = 'block';
    document.getElementById('goLiveBtn').textContent = 'Go Live: ' + staged.label;
  } else {
    bar.style.display = 'none';
  }
}
const es = new EventSource('/api/events?token=' + encodeURIComponent(token));
es.onopen = () => { document.getElementById('status').textContent = 'Connected'; document.getElementById('status').className = 'status connected'; };
es.onerror = () => { document.getElementById('status').textContent = 'Reconnecting…'; document.getElementById('status').className = 'status'; };
es.onmessage = (e) => {
  const s = JSON.parse(e.data);
  const isBlack = !s.textVisible && !s.backgroundVisible;
  const textCleared = !s.textVisible && !isBlack;
  const current = document.getElementById('current');
  current.textContent = s.current || (s.onAir ? '' : 'Nothing on air');
  current.style.opacity = (!s.textVisible) ? 0.35 : 1;
  document.getElementById('next').textContent = s.next || '—';
  document.getElementById('black').classList.toggle('active', isBlack);
  document.getElementById('clear').classList.toggle('active', textCleared);
  renderQueue(s.queue);
};
</script>
</body>
</html>`;
}

function checkToken(url: URL | null, body?: { token?: string }): boolean {
  const supplied = url?.searchParams.get('token') ?? body?.token ?? '';
  return supplied === token;
}

export async function startRemoteServer(handleAction: (type: RemoteActionType, itemId?: string) => void): Promise<RemoteStatus> {
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
          if (['next', 'prev', 'black', 'clear', 'stage', 'goLive'].includes(parsed.type)) {
            onAction?.(parsed.type, typeof parsed.itemId === 'string' ? parsed.itemId : undefined);
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
  lanUrl = await primaryLanAddress();
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
  lastQueue = [];
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
