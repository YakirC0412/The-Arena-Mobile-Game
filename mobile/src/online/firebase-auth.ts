// "Sign in with Google" through Firebase Authentication, on the web.
// npm cannot extend this app's pnpm-layout node_modules (the Colyseus SDK is vendored for the same reason), so the Firebase JS SDK
// (compat build) is loaded from Google's CDN when the welcome screen opens. Replace with the npm package once pnpm is available.
// The config values are public identifiers (they are in every Firebase web app); access is limited by the authorized domains
// in the Firebase console, not by hiding them.
const FIREBASE_VERSION = '10.12.5';
const BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

// Expo only inlines `process.env.EXPO_PUBLIC_*` when it is written out in full like this.
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isGoogleConfigured = (): boolean =>
  typeof document !== 'undefined' && !!(config.apiKey && config.authDomain && config.projectId && config.appId);

type FirebaseGlobal = {
  initializeApp: (options: object) => unknown;
  apps: unknown[];
  auth: {
    (): { signInWithPopup: (provider: unknown) => Promise<{ user: { getIdToken: () => Promise<string>; displayName: string | null; email: string | null } }>; signOut: () => Promise<void> };
    GoogleAuthProvider: new () => { setCustomParameters: (params: object) => void };
  };
};

const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
  const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
  if (existing?.dataset.loaded === 'true') return resolve();
  const script = existing ?? document.createElement('script');
  script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); });
  script.addEventListener('error', () => reject(new Error('firebase_script_failed')));
  if (!existing) {
    script.src = src;
    script.async = true;
    document.head.appendChild(script);
  }
});

let ready: Promise<FirebaseGlobal> | null = null;

// Called when the welcome screen opens, so the popup can open instantly inside the tap (iPhone blocks late popups).
export function preloadFirebase(): Promise<FirebaseGlobal> {
  ready ??= (async () => {
    await loadScript(`${BASE}/firebase-app-compat.js`);
    await loadScript(`${BASE}/firebase-auth-compat.js`);
    const firebase = (globalThis as unknown as { firebase: FirebaseGlobal }).firebase;
    if (!firebase.apps.length) firebase.initializeApp(config);
    return firebase;
  })();
  ready.catch(() => { ready = null; });
  return ready;
}

// Opens Google's popup and returns the Firebase ID token (the server verifies it) plus the name and email Google shows.
// The name and email are only used when the Arena server cannot be reached (local sign-in on this device).
export async function signInWithGoogle(): Promise<{ idToken: string; name: string; email: string }> {
  const firebase = await preloadFirebase();
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await firebase.auth().signInWithPopup(provider);
  const { displayName, email } = result.user;
  return { idToken: await result.user.getIdToken(), name: displayName ?? '', email: email ?? '' };
}

export async function signOutGoogle(): Promise<void> {
  if (!ready) return;
  try {
    const firebase = await ready;
    await firebase.auth().signOut();
  } catch {
    // nothing to sign out of
  }
}
