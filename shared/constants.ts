/** Loopback-only port for the Stream Preview embed wrapper server — see
 *  electron/streamEmbedServer.ts for why this exists. Fixed rather than ephemeral so the renderer
 *  can build the wrapper URL without an IPC round trip. */
export const STREAM_EMBED_PORT = 51831;
