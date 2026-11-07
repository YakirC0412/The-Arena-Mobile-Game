// Only the parts of the Colyseus browser SDK (colyseus-sdk.js, version 0.18.9, MIT) that the app uses.
// The file is vendored because the app's node_modules is a pnpm layout that npm cannot extend; when pnpm is set up,
// replace it with `pnpm add @colyseus/sdk` and import from the package.
export class Room {
  sessionId: string;
  roomId: string;
  send(type: string, message?: unknown): void;
  onMessage(type: string, callback: (message: any) => void): void;
  onLeave(callback: (code: number) => void): void;
  onError(callback: (code: number, message?: string) => void): void;
  leave(consented?: boolean): Promise<void>;
}

export class Client {
  constructor(endpoint: string);
  create(roomName: string, options?: Record<string, unknown>): Promise<Room>;
  joinById(roomId: string, options?: Record<string, unknown>): Promise<Room>;
}
