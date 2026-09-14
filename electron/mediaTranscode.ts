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
const BROWSER_SAFE_VIDEO_CODECS = new Set(['h264', 'vp8', 'vp9', 'av1', 'theora']);
// Chromium's software H.264 decoder only supports 8-bit 4:2:0 — "High 10", "High 4:2:2" and
// "High 4:4:4 Predictive" profiles (common in exports from pro editing tools that master in
// 10-bit) report codec_name "h264" but still fail to decode, so codec name alone isn't enough.
const UNSAFE_H264_PROFILE = /10|4:2:2|4:4:4/i;
const UNSAFE_PIX_FMT = /p10|p12|422|444/i;
const BROWSER_SAFE_AUDIO_CODECS = new Set(['aac', 'mp3', 'opus', 'vorbis', 'pcm_u8', 'pcm_s16le']);

function convertedMediaDir(): string {
  const dir = path.join(app.getPath('userData'), 'media-converted');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export interface VideoProbeResult {
  videoCodec: string | null;
  videoProfile: string | null;
  pixFmt: string | null;
  audioCodec: string | null;
}

/** Probes both video and audio streams — codec name alone isn't enough to know whether Electron can
 *  play the file back (see UNSAFE_H264_PROFILE above), so this reports profile/pixel format too. */
export async function probeVideoStreams(filePath: string): Promise<VideoProbeResult> {
  try {
    const { stdout } = await execFileAsync(
      ffprobePath,
      ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,profile,pix_fmt', '-of', 'json', filePath],
      { timeout: 15_000 }
    );
    const parsed = JSON.parse(stdout) as { streams?: Array<Record<string, string>> };
    const streams = parsed.streams ?? [];
    const video = streams.find((s) => s.codec_type === 'video');
    const audio = streams.find((s) => s.codec_type === 'audio');
    return {
      videoCodec: video?.codec_name?.toLowerCase() ?? null,
      videoProfile: video?.profile ?? null,
      pixFmt: video?.pix_fmt ?? null,
      audioCodec: audio?.codec_name?.toLowerCase() ?? null,
    };
  } catch {
    return { videoCodec: null, videoProfile: null, pixFmt: null, audioCodec: null };
  }
}

export function needsTranscode(probe: VideoProbeResult): boolean {
  const { videoCodec, videoProfile, pixFmt, audioCodec } = probe;
  if (!videoCodec || !BROWSER_SAFE_VIDEO_CODECS.has(videoCodec)) return true;
  if (videoProfile && UNSAFE_H264_PROFILE.test(videoProfile)) return true;
  if (pixFmt && UNSAFE_PIX_FMT.test(pixFmt)) return true;
  if (audioCodec && !BROWSER_SAFE_AUDIO_CODECS.has(audioCodec)) return true;
  return false;
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
