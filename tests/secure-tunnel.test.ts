import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fingerprint, SecureTunnel, tunnelKeys } from '../src/protocol/secure-tunnel';
const random = () => randomBytes(32).toString('hex');
const keys = () => tunnelKeys(random);
function pair(): [SecureTunnel, SecureTunnel] {
  const a = keys(),
    b = keys();
  return [
    new SecureTunnel(a.secretKey, b.publicKey, random),
    new SecureTunnel(b.secretKey, a.publicKey, random),
  ];
}
describe('tunnel autenticato del ponte', () => {
  it('trasporta UTF8 in entrambe le direzioni e produce nonce distinti', () => {
    const [a, b] = pair();
    const first = a.seal('mappa segreta · caffè 🗝');
    expect(JSON.stringify(first)).not.toContain('mappa');
    expect(b.open(first)).toBe('mappa segreta · caffè 🗝');
    const second = a.seal('altro');
    expect(second.nonce).not.toBe(first.nonce);
    expect(b.open(second)).toBe('altro');
    expect(a.open(b.seal('ricevuto'))).toBe('ricevuto');
  });
  it('rifiuta manomissioni, chiavi errate, riflessioni, replay e riordino', () => {
    const [a, b] = pair();
    const first = a.seal('token');
    const second = a.seal('mappa');
    expect(() =>
      b.open({ ...first, box: (first.box[0] === '0' ? '1' : '0') + first.box.slice(1) }),
    ).toThrow();
    expect(() => pair()[1].open(first)).toThrow();
    expect(() => a.open(first)).toThrow('riflesso');
    expect(() => b.open(second)).toThrow('sequenza');
    expect(b.open(first)).toBe('token');
    expect(() => b.open(first)).toThrow('duplicato');
    expect(b.open(second)).toBe('mappa');
  });
  it('rifiuta chiavi degeneri e limiti eccessivi senza saltare la sequenza', () => {
    const k = keys();
    expect(() => new SecureTunnel(k.secretKey, '0'.repeat(64), random)).toThrow();
    const [a, b] = pair();
    expect(() => a.seal('a'.repeat(14001))).toThrow();
    expect(() => a.seal('🗝'.repeat(6000))).toThrow();
    expect(b.open(a.seal('ok'))).toBe('ok');
    expect(() => b.open({ type: 'tunnel-data', box: 'a'.repeat(30000) })).toThrow();
    expect(fingerprint(k.publicKey)).toMatch(/^[A-F0-9]{4}( [A-F0-9]{4}){3}$/);
    expect(fingerprint(keys().publicKey)).not.toBe(fingerprint(k.publicKey));
  });
});
