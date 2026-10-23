import { requireNativeModule, NativeModule } from 'expo-modules-core';
export type Mode = 'bluetooth' | 'lan';
export type LinkEvent = {
  type: string;
  peer?: string;
  client?: boolean;
  relay?: boolean;
  paired?: boolean;
  stage?: 'scan' | 'services';
  text?: string;
  name?: string;
  address?: string;
  message?: string;
};
export type HostInfo = { name: string; addresses: string[]; port: number };
declare class OfflineLink extends NativeModule<{ link: (event: LinkEvent) => void }> {
  token(): string;
  randomInt(bound: number): number;
  systemLanguage(): string;
  feedback(sound: boolean): void;
  revealFeedback(kind: 'correct' | 'opponent' | 'neutral' | 'assassin', sound: boolean): void;
  readStore(key: string): Promise<string | null>;
  writeStore(key: string, value: string): Promise<void>;
  discoverable(): Promise<void>;
  discover(): Promise<void>;
  stopDiscovery(): Promise<void>;
  startHost(mode: Mode): Promise<HostInfo>;
  connect(mode: Mode, address: string, port: number, viaRelay: boolean): Promise<string>;
  startRelay(): Promise<void>;
  stopRelay(): Promise<void>;
  send(peer: string, text: string): Promise<void>;
  close(peer: string): Promise<void>;
  stop(): Promise<void>;
}
export default requireNativeModule<OfflineLink>('OfflineLink');
