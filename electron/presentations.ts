import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { Presentation } from '@shared/types';

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
}

/**
 * Converts a .pptx/.ppt file to PDF using a locally installed LibreOffice, since there is no
 * pure-JS/cross-platform way to rasterize PowerPoint slides. The resulting PDF is then rendered
 * page-by-page in the renderer with pdf.js (no native deps needed there).
 */
export async function importPresentation(sourceFilePath: string): Promise<ImportResult> {
  const outDir = presentationsDir();
  let lastError: unknown = null;

  for (const candidate of SOFFICE_CANDIDATES) {
    try {
      await execFileAsync(candidate, ['--headless', '--convert-to', 'pdf', '--outdir', outDir, sourceFilePath], {
        timeout: 60_000,
      });
      const base = path.basename(sourceFilePath, path.extname(sourceFilePath));
      const pdfPath = path.join(outDir, `${base}.pdf`);
      if (!fs.existsSync(pdfPath)) {
        lastError = new Error('LibreOffice ran but no PDF was produced.');
        continue;
      }
      const presentation: Presentation = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: base,
        sourceFilePath,
        pdfPath: `file://${pdfPath}`,
        slideCount: 0, // corrected by the renderer after the first pdf.js load
        addedAt: Date.now(),
      };
      return { presentation };
    } catch (err) {
      lastError = err;
    }
  }

  return {
    error:
      'Could not convert the PowerPoint file. This feature requires LibreOffice to be installed ' +
      `(tried: ${SOFFICE_CANDIDATES.join(', ')}). Install it from https://www.libreoffice.org/ and try again.` +
      (lastError instanceof Error ? ` Last error: ${lastError.message}` : ''),
  };
}
