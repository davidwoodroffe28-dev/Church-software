import type { BrowserWindow } from 'electron';

// grandi is ESM-only; electron/ compiles to CommonJS, so it's loaded with a dynamic import()
// rather than require(). See DESIGN-SPEC/README for why NDI exists as a third transport for the
// Stream (lower-thirds) output, alongside a physical HDMI display and OBS/vMix Window Capture.
type Grandi = typeof import('grandi').default;
// tsc compiles a plain `await import(...)` down to `require(...)` under "module": "CommonJS" (see
// dist-electron output) — that throws ERR_REQUIRE_ESM for a pure-ESM package like grandi. Routing
// through `new Function` hides the import specifier from TypeScript's transform entirely, so this
// stays a real native dynamic import at runtime, which Node's CJS loader can use to load ESM.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ default: Grandi }>;
let grandi: Grandi | null = null;
async function loadGrandi(): Promise<Grandi> {
  if (!grandi) grandi = (await dynamicImport('grandi')).default;
  return grandi;
}

// Lower thirds are mostly-static text, not fast motion — 25fps keeps capturePage()'s per-frame
// cost (it's a real compositor readback, not free) reasonable without looking choppy for slow
// text/logo changes. A dedicated capture card or Window Capture in OBS would run full framerate;
// this is a reasonable middle ground for a software fallback.
const FPS = 25;
const INTERVAL_MS = Math.round(1000 / FPS);

let sender: Awaited<ReturnType<Grandi['send']>> | null = null;
let running = false;
let loopPromise: Promise<void> | null = null;

async function captureLoop(win: BrowserWindow) {
  const g = await loadGrandi();
  while (running) {
    const tickStart = Date.now();
    if (win.isDestroyed()) break;
    try {
      const image = await win.webContents.capturePage();
      const { width, height } = image.getSize();
      if (width && height && sender) {
        await sender.video({
          xres: width,
          yres: height,
          frameRateN: FPS * 1000,
          frameRateD: 1000,
          pictureAspectRatio: width / height,
          fourCC: g.FourCC.BGRA,
          frameFormatType: g.FrameType.Progressive,
          lineStrideBytes: width * 4,
          data: image.toBitmap(), // Electron's NativeImage bitmap is already raw BGRA — no conversion needed.
        });
      }
    } catch {
      // A dropped frame (e.g. window mid-resize) shouldn't kill the loop — just try again next tick.
    }
    const elapsed = Date.now() - tickStart;
    await new Promise((r) => setTimeout(r, Math.max(0, INTERVAL_MS - elapsed)));
  }
}

/** Idempotent: safe to call with the same window repeatedly (e.g. every syncOutputWindows). */
export async function startNdiSender(win: BrowserWindow, name: string) {
  if (running && sender?.name === name) return;
  await stopNdiSender();
  const g = await loadGrandi();
  sender = await g.send({ name });
  running = true;
  loopPromise = captureLoop(win);
}

export async function stopNdiSender() {
  running = false;
  if (loopPromise) {
    await loopPromise.catch(() => {});
    loopPromise = null;
  }
  if (sender) {
    sender.destroy();
    sender = null;
  }
}
