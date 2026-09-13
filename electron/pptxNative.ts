import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import type { NativeSlide, NativeTextBox, NativeTextRun } from '@shared/types';

// EMU (English Metric Units) — the unit PPTX geometry is stored in. 914400 EMU = 1 inch.
const EMU_PER_INCH = 914400;
const EMU_PER_POINT = EMU_PER_INCH / 72;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  removeNSPrefix: true, // <p:sp> -> sp, <a:t> -> t, etc. — namespaces aren't ambiguous within OOXML parts
});

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function mimeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

interface SlideSize {
  wEmu: number;
  hEmu: number;
}

/** Fallback box (as % of slide) per placeholder type, used only when the shape has no <a:xfrm>. */
const DEFAULT_PLACEHOLDER_BOX: Record<string, { xPct: number; yPct: number; wPct: number; hPct: number }> = {
  title: { xPct: 10, yPct: 8, wPct: 80, hPct: 20 },
  ctrTitle: { xPct: 10, yPct: 35, wPct: 80, hPct: 20 },
  subTitle: { xPct: 10, yPct: 55, wPct: 80, hPct: 15 },
  body: { xPct: 10, yPct: 25, wPct: 80, hPct: 65 },
};

function parseAlign(algn: string | undefined): 'left' | 'center' | 'right' {
  if (algn === 'ctr') return 'center';
  if (algn === 'r') return 'right';
  return 'left';
}

interface RunProps {
  bold?: boolean;
  italic?: boolean;
  fontSizePt?: number;
  color?: string;
}

function extractRunProps(rPr: Record<string, unknown> | undefined): RunProps {
  if (!rPr) return {};
  const bold = rPr['@_b'] === '1' || rPr['@_b'] === 1;
  const italic = rPr['@_i'] === '1' || rPr['@_i'] === 1;
  const szRaw = rPr['@_sz'];
  const fontSizePt = szRaw != null ? Number(szRaw) / 100 : undefined;
  const solidFill = rPr.solidFill as Record<string, unknown> | undefined;
  const srgb = solidFill?.srgbClr as Record<string, unknown> | undefined;
  const color = srgb?.['@_val'] ? `#${srgb['@_val']}` : undefined;
  return { bold, italic, fontSizePt, color };
}

function parseTextBody(txBody: Record<string, unknown> | undefined, slideSize: SlideSize): NativeTextBox['paragraphs'] {
  if (!txBody) return [];
  const paragraphs = asArray(txBody.p as Record<string, unknown> | Record<string, unknown>[]);
  return paragraphs.map((p) => {
    const runs = asArray(p.r as Record<string, unknown> | Record<string, unknown>[]).map((r) => {
      const text = String((r.t as string) ?? '');
      const { bold, italic, color, fontSizePt } = extractRunProps(r.rPr as Record<string, unknown>);
      const fontSizePct = fontSizePt ? ((fontSizePt * EMU_PER_POINT) / slideSize.hEmu) * 100 : undefined;
      const run: NativeTextRun = { text, bold, italic, color, fontSizePct };
      return run;
    });
    return { runs };
  });
}

function findBackgroundImage(
  spTree: Record<string, unknown>,
  mediaByRid: Map<string, string>,
  slideSize: SlideSize
): string | undefined {
  const pics = asArray(spTree.pic as Record<string, unknown> | Record<string, unknown>[]);
  let best: { area: number; dataUri: string } | null = null;
  for (const pic of pics) {
    const blipFill = pic.blipFill as Record<string, unknown> | undefined;
    const blip = blipFill?.blip as Record<string, unknown> | undefined;
    const rid = blip?.['@_embed'] as string | undefined;
    if (!rid) continue;
    const dataUri = mediaByRid.get(rid);
    if (!dataUri) continue;

    const xfrm = (pic.spPr as Record<string, unknown>)?.xfrm as Record<string, unknown> | undefined;
    const ext = xfrm?.ext as Record<string, unknown> | undefined;
    const cx = Number(ext?.['@_cx'] ?? slideSize.wEmu);
    const cy = Number(ext?.['@_cy'] ?? slideSize.hEmu);
    const area = cx * cy;
    // Heuristic: treat the largest picture covering most of the slide as the background.
    if (area > slideSize.wEmu * slideSize.hEmu * 0.6 && (!best || area > best.area)) {
      best = { area, dataUri };
    }
  }
  return best?.dataUri;
}

function parseSlideBackgroundColor(slideXmlRoot: Record<string, unknown>): string | undefined {
  const cSld = slideXmlRoot.cSld as Record<string, unknown> | undefined;
  const bg = cSld?.bg as Record<string, unknown> | undefined;
  const bgPr = bg?.bgPr as Record<string, unknown> | undefined;
  const srgb = (bgPr?.solidFill as Record<string, unknown>)?.srgbClr as Record<string, unknown> | undefined;
  return srgb?.['@_val'] ? `#${srgb['@_val']}` : undefined;
}

async function loadMediaByRid(zip: JSZip, slideRelsPath: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const relsFile = zip.file(slideRelsPath);
  if (!relsFile) return map;
  const relsXml = parser.parse(await relsFile.async('text'));
  const relationships = asArray(relsXml.Relationships?.Relationship as Record<string, unknown> | Record<string, unknown>[]);
  for (const rel of relationships) {
    const type = String(rel['@_Type'] ?? '');
    if (!type.endsWith('/image')) continue;
    const target = String(rel['@_Target'] ?? '');
    const mediaPath = target.startsWith('../') ? `ppt/${target.slice(3)}` : `ppt/slides/${target}`;
    const file = zip.file(mediaPath);
    if (!file) continue;
    const base64 = await file.async('base64');
    const ext = mediaPath.split('.').pop() ?? 'png';
    map.set(String(rel['@_Id']), `data:${mimeForExt(ext)};base64,${base64}`);
  }
  return map;
}

export async function parsePptxNative(buffer: Buffer): Promise<{ slides: NativeSlide[] }> {
  const zip = await JSZip.loadAsync(buffer);

  const presentationXml = parser.parse(await zip.file('ppt/presentation.xml')!.async('text'));
  const sldSz = presentationXml.presentation?.sldSz;
  const slideSize: SlideSize = {
    wEmu: Number(sldSz?.['@_cx'] ?? 12_192_000),
    hEmu: Number(sldSz?.['@_cy'] ?? 6_858_000),
  };

  const presRels = parser.parse(await zip.file('ppt/_rels/presentation.xml.rels')!.async('text'));
  const relById = new Map<string, string>();
  for (const rel of asArray(presRels.Relationships?.Relationship as Record<string, unknown> | Record<string, unknown>[])) {
    relById.set(String(rel['@_Id']), String(rel['@_Target']));
  }

  const sldIdLst = asArray(
    presentationXml.presentation?.sldIdLst?.sldId as Record<string, unknown> | Record<string, unknown>[]
  );
  const slidePaths = sldIdLst
    .map((s) => relById.get(String(s['@_id'] ?? s['@_r:id'] ?? Object.values(s).find((v) => typeof v === 'string'))))
    .filter((p): p is string => !!p)
    .map((p) => `ppt/${p.replace(/^\.?\//, '')}`);

  const slides: NativeSlide[] = [];

  for (const slidePath of slidePaths) {
    const file = zip.file(slidePath);
    if (!file) continue;
    const slideXml = parser.parse(await file.async('text'));
    const slideRoot = slideXml.sld as Record<string, unknown>;
    if (!slideRoot) continue;

    const slideFileName = slidePath.split('/').pop()!;
    const relsPath = `ppt/slides/_rels/${slideFileName}.rels`;
    const mediaByRid = await loadMediaByRid(zip, relsPath);

    const spTree = (slideRoot.cSld as Record<string, unknown>)?.spTree as Record<string, unknown>;
    const textBoxes: NativeTextBox[] = [];

    if (spTree) {
      for (const sp of asArray(spTree.sp as Record<string, unknown> | Record<string, unknown>[])) {
        const txBody = sp.txBody as Record<string, unknown> | undefined;
        const paragraphs = parseTextBody(txBody, slideSize);
        const hasText = paragraphs.some((p) => p.runs.some((r) => r.text.trim().length));
        if (!hasText) continue;

        // Most placeholder text (title/body) has no explicit per-run font size in the slide XML —
        // it's inherited from the slide layout/master, which this reader doesn't resolve. Fall back
        // to a sensible size based on the placeholder type so titles still read larger than body text.
        const nvPr = (sp.nvSpPr as Record<string, unknown>)?.nvPr as Record<string, unknown> | undefined;
        const phType = String((nvPr?.ph as Record<string, unknown>)?.['@_type'] ?? '');
        const defaultFontSizePct = phType === 'title' || phType === 'ctrTitle' ? 7 : phType === 'subTitle' ? 5 : 4.5;
        for (const para of paragraphs) {
          for (const run of para.runs) {
            if (run.fontSizePct == null) run.fontSizePct = defaultFontSizePct;
          }
        }

        const spPr = sp.spPr as Record<string, unknown> | undefined;
        const xfrm = spPr?.xfrm as Record<string, unknown> | undefined;
        const off = xfrm?.off as Record<string, unknown> | undefined;
        const ext = xfrm?.ext as Record<string, unknown> | undefined;

        // Placeholders (title/subtitle/body) very often have no direct <a:xfrm> at all — their
        // position is inherited from the slide layout, which this reader doesn't resolve. Without a
        // type-aware fallback here, e.g. a title and subtitle would both default to the same box and
        // render stacked on top of each other, so use a distinct default per placeholder type instead.
        const defaultBox = DEFAULT_PLACEHOLDER_BOX[phType] ?? DEFAULT_PLACEHOLDER_BOX.body;
        const x = Number(off?.['@_x'] ?? defaultBox.xPct * 0.01 * slideSize.wEmu);
        const y = Number(off?.['@_y'] ?? defaultBox.yPct * 0.01 * slideSize.hEmu);
        const w = Number(ext?.['@_cx'] ?? defaultBox.wPct * 0.01 * slideSize.wEmu);
        const h = Number(ext?.['@_cy'] ?? defaultBox.hPct * 0.01 * slideSize.hEmu);

        const firstParaProps = asArray(txBody?.p as Record<string, unknown> | Record<string, unknown>[])[0]?.pPr as
          | Record<string, unknown>
          | undefined;

        textBoxes.push({
          xPct: (x / slideSize.wEmu) * 100,
          yPct: (y / slideSize.hEmu) * 100,
          wPct: (w / slideSize.wEmu) * 100,
          hPct: (h / slideSize.hEmu) * 100,
          align: parseAlign(firstParaProps?.['@_algn'] as string | undefined),
          paragraphs,
        });
      }
    }

    slides.push({
      backgroundColor: parseSlideBackgroundColor(slideRoot),
      backgroundImage: spTree ? findBackgroundImage(spTree, mediaByRid, slideSize) : undefined,
      textBoxes,
    });
  }

  return { slides };
}
