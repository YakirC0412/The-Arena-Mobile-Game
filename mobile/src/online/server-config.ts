// Where the Arena server is. On the home PC the site and the server run on the same machine, so the server is
// "the address the page was opened from, port 2567" (an iPhone opening http://10.0.0.44:8090 talks to 10.0.0.44:2567).
// EXPO_PUBLIC_ARENA_SERVER overrides it (for example a public https address later).
export function serverHttpUrl(): string {
  const configured = process.env.EXPO_PUBLIC_ARENA_SERVER;
  if (configured) return configured.replace(/\/$/, '');
  const host = globalThis.location?.hostname || 'localhost';
  return `http://${host}:2567`;
}

export const serverWsUrl = (): string => serverHttpUrl().replace(/^http/, 'ws');
