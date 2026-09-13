import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { Presentation } from '@shared/types';
import { parsePptxNative } from './pptxNative';

const execFileAsync = promisify(execFile);

// LibreOffice's binary name differs by platform/install; try the common ones in order.
const SOFFICE_CANDIDATES =
  process.platform === 'win32'
    ? ['soffice.exe', 'C:\\Program Files\\LibreOffice\\program\\soffice.exe']
    : process.platform === 'darwin'
      ? ['soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice']
      : ['soffice', 'libreoffice'];

function presentationsDir(): string {
  const dir = path.join(app.getPath('userData'), 'presentations');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export interface ImportResult {
  presentation?: Presentation;
  error?: string;
  /** Non-fatal heads-up, e.g. "LibreOffice wasn't found, imported with reduced fidelity instead". */
  warning?: string;
}

function newPresentationShell(sourceFilePath: string): Pick<Presentation, 'id' | 'name' | 'sourceFilePath' | 'addedAt'> {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: path.basename(sourceFilePath, path.extname(sourceFilePath)),
    sourceFilePath,
    addedAt: Date.now(),
  };
}

/** Converts via a locally installed LibreOffice for pixel-accurate rendering. Returns null (not a
 *  thrown error) if LibreOffice isn't available or the conversion otherwise fails, so the caller can
 *  fall back to the native parser. */
async function tryLibreOfficeConvert(sourceFilePath: string): Promise<Presentation | null> {
  const outDir = presentationsDir();

  for (const candidate of SOFFICE_CANDIDATES) {
    try {
      await execFileAsync(candidate, ['--headless', '--convert-to', 'pdf', '--outdir', outDir, sourceFilePath], {
        timeout: 60_000,
      });
      const base = path.basename(sourceFilePath, path.extname(sourceFilePath));
      const pdfPath = path.join(outDir, `${base}.pdf`);
      if (!fs.existsSync(pdfPath)) continue;
      return {
        ...newPresentationShell(sourceFilePath),
        mode: 'pdf',
        pdfPath: `file://${pdfPath}`,
        slideCount: 0, // corrected by the renderer after the first pdf.js load
      };
    } catch {
      // try the next candidate / fall through to the native parser
    }
  }
  return null;
}

/** Best-effort, dependency-free fallback: reads the .pptx XML directly (approximate layout/fonts,
 *  no master/layout inheritance or effects) — used automatically when LibreOffice isn't installed. */
async function tryNativeParse(sourceFilePath: string): Promise<Presentation | null> {
  try {
    const buffer = fs.readFileSync(sourceFilePath);
    const { slides } = await parsePptxNative(buffer);
    if (!slides.length) return null;
    return {
      ...newPresentationShell(sourceFilePath),
      mode: 'native',
      nativeSlides: slides,
      slideCount: slides.length,
    };
  } catch {
    return null;
  }
}

export async function importPresentation(sourceFilePath: string): Promise<ImportResult> {
  const viaLibreOffice = await tryLibreOfficeConvert(sourceFilePath);
  if (viaLibreOffice) return { presentation: viaLibreOffice };

  const viaNative = await tryNativeParse(sourceFilePath);
  if (viaNative) {
    return {
      presentation: viaNative,
      warning:
        "LibreOffice wasn't found, so this was imported with the built-in reader instead: layout, fonts, " +
        'and effects are approximate rather than pixel-accurate. Install LibreOffice (free, ' +
        'https://www.libreoffice.org/) and re-import for an exact match to the original slides.',
    };
  }

  return {
    error:
      'Could not import this PowerPoint file, either via LibreOffice or the built-in reader. Install ' +
      'LibreOffice (https://www.libreoffice.org/) for the most reliable import, and confirm the file ' +
      'is a valid, non-corrupt .pptx/.ppt.',
  };
}
