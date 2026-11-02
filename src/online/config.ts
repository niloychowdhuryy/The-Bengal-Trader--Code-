// Only public values belong here: the Supabase URL and publishable key are designed
// to reach the browser. With neither set, the game is simply offline-only.
export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "local";

const ISSUES_URL = "https://github.com/niloychowdhuryy/The-Bengal-Trader--Code-/issues/new";

export function getProblemReportUrl(): string {
  const body = `Game version: ${APP_VERSION}\n\nWhat happened?\n\nWhat did you expect?\n`;
  return `${ISSUES_URL}?body=${encodeURIComponent(body)}`;
}

export interface OnlineConfig {
  url: string;
  publishableKey: string;
}

export function getOnlineConfig(): OnlineConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  // A secret key in a browser build would expose it to every player.
  if (publishableKey.startsWith("sb_secret_")) return null;
  return { url, publishableKey };
}
