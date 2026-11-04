/**
 * Everything the Lab and ghost challenges share is encoded in the URL hash,
 * so links work on the static build, offline, and without an account or API.
 */
export function labRoute(code: string): string {
  return `/lab/${encodeURIComponent(code)}`;
}

export function rivalRoute(code: string): string {
  return `/rival/${encodeURIComponent(code)}`;
}

export function absoluteHashUrl(route: string): string {
  if (typeof window === "undefined") return `#${route}`;
  return `${window.location.href.split("#")[0]}#${route}`;
}

/** Clipboard API first, then the old hidden-textarea trick for in-app browsers. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based copy below.
  }
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}
