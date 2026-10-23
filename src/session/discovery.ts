export type NearbyDevice = {
  name: string;
  address: string;
  verified: boolean;
  paired: boolean;
  relay?: boolean;
};

export function mergeDevice(
  devices: NearbyDevice[],
  event: { type: string; address: string; name?: string; paired?: boolean; relay?: boolean },
): NearbyDevice[] {
  const existing = devices.filter((d) => d.address === event.address);
  const name = event.name?.trim() || existing[0]?.name || 'Dispositivo Bluetooth';
  const paired = event.paired ?? existing[0]?.paired ?? false;
  let next: NearbyDevice[];
  if (event.type === 'host') {
    next = devices.filter(
      (d) => d.address !== event.address || (d.verified && !!d.relay !== !!event.relay),
    );
    next.push({ name, address: event.address, paired, verified: true, relay: !!event.relay });
  } else if (existing.length) {
    next = devices.map((d) => (d.address === event.address ? { ...d, name, paired } : d));
  } else {
    next = [...devices, { name, address: event.address, paired, verified: false }];
  }
  return next.sort(
    (a, b) =>
      Number(b.verified) - Number(a.verified) ||
      Number(b.paired) - Number(a.paired) ||
      a.name.localeCompare(b.name, 'it'),
  );
}
