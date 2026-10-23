import { describe, expect, it } from 'vitest';
import { mergeDevice } from '../src/session/discovery';

describe('dispositivi Bluetooth e verifica del servizio', () => {
  it('mostra un dispositivo senza UUID e lo aggiorna senza duplicarlo', () => {
    let devices = mergeDevice([], { type: 'device', address: 'A', paired: true });
    expect(devices[0]).toMatchObject({
      verified: false,
      paired: true,
      name: 'Dispositivo Bluetooth',
    });
    devices = mergeDevice(devices, { type: 'device', address: 'A', name: 'Telefono Anna' });
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ name: 'Telefono Anna', paired: true, verified: false });
  });
  it('promuove il candidato a host e non lo declassa con un successivo rilevamento', () => {
    let devices = mergeDevice([], { type: 'device', address: 'A', paired: true });
    devices = mergeDevice(devices, { type: 'host', address: 'A', name: 'Host' });
    devices = mergeDevice(devices, { type: 'device', address: 'A', name: 'Host aggiornato' });
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ verified: true, paired: true, name: 'Host aggiornato' });
  });
  it('conserva separatamente host e ponte sullo stesso indirizzo senza duplicati', () => {
    let devices = mergeDevice([], { type: 'host', address: 'A', relay: false });
    devices = mergeDevice(devices, { type: 'host', address: 'A', relay: true });
    devices = mergeDevice(devices, { type: 'host', address: 'A', relay: true });
    expect(devices).toHaveLength(2);
    expect(devices.map((d) => d.relay).sort()).toEqual([false, true]);
  });
  it('ordina prima i servizi riconosciuti, poi i dispositivi associati', () => {
    let devices = mergeDevice([], { type: 'device', address: 'A', name: 'A' });
    devices = mergeDevice(devices, { type: 'device', address: 'B', name: 'B', paired: true });
    devices = mergeDevice(devices, { type: 'host', address: 'C', name: 'C' });
    expect(devices.map((d) => d.address)).toEqual(['C', 'B', 'A']);
  });
});
