/** Turns whatever a volunteer pastes into Settings → Stream into a YouTube embed src, for the
 *  floating Stream Preview panel (see StreamPreview.tsx). Two shapes are supported:
 *   - A specific video/live URL (watch?v=, youtu.be/, /embed/, /live/) → embeds that exact video.
 *   - A channel — its /channel/UC…/live URL, or just the bare "UC…" id — → embeds YouTube's
 *     live_stream player for that channel, which always shows whatever's currently live there.
 *     This is the one worth persisting week to week: set it once, it just works every Sunday.
 *  Handle/vanity URLs (youtube.com/@name, /c/name) aren't supported — resolving those to a channel
 *  id requires an authenticated Data API call, out of scope for a paste-and-go field. Returns null
 *  (rather than throwing) for anything unrecognized, so the caller can show a plain hint.
 */
export function toYouTubeEmbedSrc(source: string): string | null {
  const trimmed = source.trim();
  if (!trimmed) return null;

  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return `https://www.youtube.com/embed/live_stream?channel=${trimmed}&autoplay=1&mute=1`;
  }

  let url: URL;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (!/(^|\.)youtube\.com$/.test(url.hostname) && url.hostname !== 'youtu.be') return null;

  if (url.hostname === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1` : null;
  }

  const videoId = url.searchParams.get('v');
  if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'embed' && parts[1]) return `https://www.youtube.com/embed/${parts[1]}?autoplay=1&mute=1`;
  if (parts[0] === 'live' && parts[1]) return `https://www.youtube.com/embed/${parts[1]}?autoplay=1&mute=1`;
  if (parts[0] === 'channel' && parts[1]) {
    return `https://www.youtube.com/embed/live_stream?channel=${parts[1]}&autoplay=1&mute=1`;
  }

  return null;
}
