/**
 * Google sign-in button for the web build (Google Identity Services). Off until
 * VITE_GOOGLE_CLIENT_ID is set. The Android app will use a native Google
 * sign-in plugin instead and hand its ID token to signInWithGoogle().
 */
export const GOOGLE_CLIENT_ID = (import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

export const googleSignInEnabled = () => GOOGLE_CLIENT_ID !== "";

interface Oauth2 {
  initTokenClient(options: {
    client_id: string;
    scope: string;
    callback: (response: { access_token?: string }) => void;
    error_callback: () => void;
  }): { requestAccessToken(): void };
}

interface Gsi {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(element: HTMLElement, options: Record<string, unknown>): void;
      prompt(listener?: (moment: { isNotDisplayed(): boolean; isSkippedMoment(): boolean; isDismissedMoment(): boolean }) => void): void;
      disableAutoSelect(): void;
    };
  };
}

let loading: Promise<Gsi> | null = null;

function loadGsi(): Promise<Gsi> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve((window as unknown as { google: Gsi }).google);
    script.onerror = () => {
      loading = null;
      reject(new Error("Google sign-in could not load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Google's library may only be initialized once per page: every extra call
 * replaces the previous callback (and logs a warning), which would break the
 * button that was drawn first. So one init registers a forwarder that always
 * calls the handler registered last.
 */
let initialized = false;
let latestHandler: ((idToken: string) => void) | null = null;

/** Draws Google's own button into `element`; `onToken` gets the ID token after the player picks an account. */
export async function renderGoogleButton(element: HTMLElement, onToken: (idToken: string) => void): Promise<void> {
  const { accounts } = await loadGsi();
  latestHandler = onToken;
  if (!initialized) {
    initialized = true;
    accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: response => latestHandler?.(response.credential),
    });
  }
  accounts.id.renderButton(element, { theme: "filled_black", size: "large", shape: "rectangular" });
}

/** Start loading Google's script early, so the sign-in popup can open straight from a click. */
export const preloadGoogle = () => void loadGsi().catch(() => undefined);

/**
 * Opens Google's account popup. It must run inside a click handler (no await before it), so it
 * returns false when the script has not loaded yet. `onToken` gets an access token the worker can check.
 */
export function openGooglePopup(onToken: (accessToken: string) => void, onFail: () => void): boolean {
  const gis = (window as unknown as { google?: { accounts?: { oauth2?: Oauth2 } } }).google?.accounts?.oauth2;
  if (!gis) return false;
  gis
    .initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid",
      callback: response => (response.access_token ? onToken(response.access_token) : onFail()),
      error_callback: onFail,
    })
    .requestAccessToken();
  return true;
}

/** Stops Google from picking the same account again without asking, after a sign-out. */
export const forgetGoogleAccount = () => loadGsi().then(({ accounts }) => accounts.id.disableAutoSelect()).catch(() => undefined);
