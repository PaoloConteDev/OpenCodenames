import nacl from 'tweetnacl';
import { ensure } from '../core/model';

export type TunnelKeys = { publicKey: string; secretKey: string };
export type SealedPacket = { v: 1; type: 'tunnel-data'; nonce: string; box: string };
export const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
export function bytes(value: unknown, length?: number): Uint8Array {
  ensure(
    typeof value === 'string' && /^[a-f0-9]+$/.test(value) && value.length % 2 === 0,
    'Dati cifrati non validi',
  );
  ensure(length === undefined || value.length === length * 2, 'Chiave o nonce non validi');
  return new Uint8Array(value.match(/../g)!.map((b) => Number.parseInt(b, 16)));
}
function utf8(text: string) {
  const escaped = encodeURIComponent(text);
  const result: number[] = [];
  for (let i = 0; i < escaped.length; i++) {
    if (escaped[i] === '%') {
      result.push(parseInt(escaped.slice(i + 1, i + 3), 16));
      i += 2;
    } else result.push(escaped.charCodeAt(i));
  }
  return new Uint8Array(result);
}
const text = (data: Uint8Array) =>
  decodeURIComponent(Array.from(data, (b) => '%' + b.toString(16).padStart(2, '0')).join(''));
export function tunnelKeys(random: () => string): TunnelKeys {
  const key = nacl.box.keyPair.fromSecretKey(bytes(random(), 32));
  return { publicKey: hex(key.publicKey), secretKey: hex(key.secretKey) };
}
export function fingerprint(publicKey: string): string {
  return hex(nacl.hash(bytes(publicKey, 32)).slice(0, 8))
    .toUpperCase()
    .match(/.{4}/g)!
    .join(' ');
}
/** Curve25519 / XSalsa20-Poly1305. Only opaque authenticated frames cross a relay. */
export class SecureTunnel {
  private shared: Uint8Array;
  private sent = 0;
  private received = 0;
  private sender: string;
  private recipient: string;
  constructor(
    secretKey: string,
    publicKey: string,
    private random: () => string,
  ) {
    const pub = bytes(publicKey, 32);
    const secret = bytes(secretKey, 32);
    ensure(
      nacl.scalarMult(secret, pub).some((b) => b !== 0),
      'Chiave remota non valida',
    );
    this.shared = nacl.box.before(pub, secret);
    this.sender = hex(nacl.scalarMult.base(secret));
    this.recipient = publicKey;
  }
  seal(payload: string): SealedPacket {
    ensure(payload.length <= 14000, 'Messaggio troppo grande per il ponte');
    const plain = utf8(JSON.stringify({ seq: this.sent + 1, sender: this.sender, payload }));
    ensure(plain.length <= 14500, 'Messaggio troppo grande per il ponte');
    const nonce = bytes(this.random(), 32).slice(0, 24);
    this.sent++;
    return {
      v: 1,
      type: 'tunnel-data',
      nonce: hex(nonce),
      box: hex(nacl.box.after(plain, nonce, this.shared)),
    };
  }
  open(packet: Record<string, unknown>): string {
    ensure(
      packet.type === 'tunnel-data' && typeof packet.box === 'string' && packet.box.length <= 29100,
      'Pacchetto del ponte non valido',
    );
    const plain = nacl.box.open.after(bytes(packet.box), bytes(packet.nonce, 24), this.shared);
    ensure(plain, 'Messaggio cifrato alterato o chiave errata');
    const data = JSON.parse(text(plain));
    ensure(
      data.sender === this.recipient &&
        data.seq === this.received + 1 &&
        typeof data.payload === 'string',
      'Messaggio del ponte duplicato, riflesso o fuori sequenza',
    );
    this.received = data.seq;
    return data.payload;
  }
}
