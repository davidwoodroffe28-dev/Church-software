import http from 'node:http';
// A relative path, not the '@shared/*' alias: that alias is TS-only (used for type-checking) and
// isn't rewritten at emit time, so a runtime `require('@shared/...')` would fail — every existing
// shared/ import in electron/ happened to be `import type` (erased entirely), so this was never hit
// until now, the first *value* import electron/ needed from shared/.
import { STREAM_EMBED_PORT } from '../shared/constants';

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8">
<style>html,body,iframe{margin:0;padding:0;border:0;width:100%;height:100%;background:#000}</style>
</head><body>
<iframe id="f" allow="autoplay; encrypted-media" allowfullscreen></iframe>
<script>
  var src = new URLSearchParams(location.search).get('src');
  if (src && /^https:\\/\\/www\\.youtube\\.com\\/embed\\//.test(src)) {
    document.getElementById('f').src = src;
  }
</script>
</body></html>`;

let server: http.Server | null = null;

/** A tiny loopback-only static page whose sole job is giving the Stream Preview's YouTube <iframe>
 *  a real HTTP parent origin. The control window itself loads via file:// in production, and
 *  YouTube's player rejects embedding from a file:// (null) origin with "Video player configuration
 *  error" (error 153) — confirmed by testing: the exact same embed succeeds once the parent page is
 *  served over http, which is how dev mode already works (Vite on localhost). Rather than serving
 *  the *whole* app over http in production too — which would reopen the file://-media-from-http://
 *  block that webSecurity was relaxed for in dev only (see loadRendererPage in main.ts) — this
 *  serves just a one-iframe wrapper page, so only the YouTube embed's immediate parent has a normal
 *  origin; nothing else about how the app loads changes. */
export function startStreamEmbedServer() {
  if (server) return;
  server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(PAGE);
  });
  // Best-effort: if the port's somehow taken, the Stream Preview iframe just won't load — not
  // worth surfacing further, nothing else in the app depends on this server.
  server.on('error', () => {});
  // 'localhost', not '127.0.0.1': YouTube's embed player treats a bare-IP referrer differently and
  // still refuses to play ("This video is unavailable") even once the null-origin issue is fixed.
  server.listen(STREAM_EMBED_PORT, 'localhost');
}
