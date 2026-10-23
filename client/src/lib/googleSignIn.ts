/**
 * Google sign-in button for the web build (Google Identity Services). Off until
 * VITE_GOOGLE_CLIENT_ID is set. The Android app will use a native Google
 * sign-in plugin instead and hand its ID token to signInWithGoogle().
 */
export const GOOGLE_CLIENT_ID = (import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

export const googleSignInEnabled = () => GOOGLE_CLIENT_ID !== "";

interface Gsi {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(element: HTMLElement, options: Record<string, unknown>): void;
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

/** Draws Google's own button into `element`; `onToken` gets the ID token after the player picks an account. */
export async function renderGoogleButton(element: HTMLElement, onToken: (idToken: string) => void): Promise<void> {
  const { accounts } = await loadGsi();
  accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: response => onToken(response.credential) });
  accounts.id.renderButton(element, { theme: "filled_black", size: "large", shape: "rectangular" });
}
