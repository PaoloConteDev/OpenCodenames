/** Portable reference codec, used by protocol tests. Android uses FrameCodec.kt. */
import { MAX_FRAME_BYTES } from './messages';
export function encode(text: string): Uint8Array {
  const payload = new TextEncoder().encode(text);
  if (!payload.length || payload.length > MAX_FRAME_BYTES)
    throw new Error('Dimensione messaggio non valida');
  const frame = new Uint8Array(payload.length + 4);
  new DataView(frame.buffer).setUint32(0, payload.length);
  frame.set(payload, 4);
  return frame;
}
export class Decoder {
  private buffer = new Uint8Array(0);
  feed(chunk: Uint8Array): string[] {
    // Bounded single chunk too: native readers only allocate a validated frame length.
    if (chunk.length > MAX_FRAME_BYTES * 4) throw new Error('Chunk troppo grande');
    const all = new Uint8Array(this.buffer.length + chunk.length);
    all.set(this.buffer);
    all.set(chunk, this.buffer.length);
    this.buffer = all;
    const out: string[] = [];
    while (this.buffer.length >= 4) {
      const len = new DataView(this.buffer.buffer, this.buffer.byteOffset, 4).getUint32(0);
      if (len < 1 || len > MAX_FRAME_BYTES) {
        this.buffer = new Uint8Array(0);
        throw new Error('Frame non valido');
      }
      if (this.buffer.length < len + 4) break;
      out.push(new TextDecoder('utf-8', { fatal: true }).decode(this.buffer.slice(4, len + 4)));
      this.buffer = this.buffer.slice(len + 4);
    }
    return out;
  }
}
