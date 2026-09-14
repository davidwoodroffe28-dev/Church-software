// Bundles FFmpeg (GPL-3.0 — see README's "Third-party licenses" section) as a standalone external
// binary invoked via execFile, never linked into this app's own code — the standard "mere
// aggregation" pattern GPL explicitly permits, the same one this project already uses for
// LibreOffice (electron/presentations.ts). Source: https://ffmpeg.org/ (also the upstream for the
// prebuilt binaries ffmpeg-static/ffprobe-static download).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import ffmpegPath from 'ffmpeg-static';
import { path as ffprobePath } from 'ffprobe-static';

const execFileAsync = promisify(execFile);

// Chromium (and therefore Electron) decodes these natively — no conversion needed. Anything else
// (HEVC/H.265 above all — the default on iPhone recordings since iOS 11 — plus older MPEG-4 Part 2,
// WMV, etc.) fails to decode at all in Electron, silently rendering blank with a plain <video>.
const BROWSER_SAFE_CODECS = new Set(['h264', 'vp8', 'vp9', 'av1', 'theora']);

function convertedMediaDir(): string {
  const dir = path.join(app.getPath('userData'), 'media-converted');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Returns the video stream's codec name (e.g. "h264", "hevc"), or null if ffprobe can't read it —
 *  treated as "needs transcoding" by the caller, since an unreadable codec is not a safe one. */
export async function probeVideoCodec(filePath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      ffprobePath,
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', filePath],
      { timeout: 15_000 }
    );
    const codec = stdout.trim().toLowerCase();
    return codec || null;
  } catch {
    return null;
  }
}

export function needsTranscode(codec: string | null): boolean {
  return !codec || !BROWSER_SAFE_CODECS.has(codec);
}

/** Transcodes to an H.264/AAC MP4 Electron can always decode. Takes real time for longer clips —
 *  the caller should show that this is happening, not treat it as instant like a normal import. */
export async function transcodeToH264(sourceFilePath: string): Promise<string> {
  if (!ffmpegPath) throw new Error('Bundled ffmpeg binary not found for this platform.');
  const outDir = convertedMediaDir();
  const base = path.basename(sourceFilePath, path.extname(sourceFilePath));
  const outPath = path.join(outDir, `${base}-${Date.now()}.mp4`);

  await execFileAsync(
    ffmpegPath,
    [
      '-y',
      '-i', sourceFilePath,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p', // some HEVC sources use 10-bit/4:2:2 chroma Chromium's H.264 decoder won't accept
      '-c:a', 'aac',
      '-movflags', '+faststart',
      outPath,
    ],
    { timeout: 10 * 60_000 } // background/loop clips are usually short, but don't hang forever on a long one
  );

  return outPath;
}
