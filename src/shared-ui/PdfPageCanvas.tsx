import { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// One shared cache so re-rendering the same deck (e.g. stepping between slides) doesn't
// re-fetch/re-parse the PDF from disk every time.
const documentCache = new Map<string, Promise<pdfjsLib.PDFDocumentProxy>>();

function getDocument(pdfPath: string): Promise<pdfjsLib.PDFDocumentProxy> {
  let cached = documentCache.get(pdfPath);
  if (!cached) {
    cached = pdfjsLib.getDocument(pdfPath).promise;
    documentCache.set(pdfPath, cached);
  }
  return cached;
}

interface Props {
  pdfPath: string;
  pageNumber: number;
  onPageCount?: (count: number) => void;
  className?: string;
}

export function PdfPageCanvas({ pdfPath, pageNumber, onPageCount, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const doc = await getDocument(pdfPath);
        if (cancelled) return;
        onPageCount?.(doc.numPages);
        const page = await doc.getPage(Math.min(Math.max(pageNumber, 1), doc.numPages));
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const containerWidth = canvas.parentElement?.clientWidth || 1280;
        const containerHeight = canvas.parentElement?.clientHeight || 720;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / baseViewport.width, containerHeight / baseViewport.height);
        const viewport = page.getViewport({ scale: scale || 1 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.error('Failed to render presentation slide', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfPath, pageNumber, onPageCount]);

  return (
    <div className={className} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
