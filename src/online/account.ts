import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnlineConfig } from "./config";

export interface PlayerProfile {
  displayName: string | null;
  ageConfirmed: boolean;
}

export type ProfileError =
  | "name-invalid"
  | "name-taken"
  | "age-required"
  | "unavailable";

export type AccountStatus =
  /** Reading a saved session or finishing a sign-in. */
  | { kind: "loading" }
  | { kind: "signed-out"; error?: string }
  | {
      kind: "signed-in";
      email: string;
      /** Null when the profile couldn't be read, for example while offline. */
      profile: PlayerProfile | null;
    };

export interface AccountService {
  subscribe(listener: (status: AccountStatus) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  completeProfile(
    displayName: string,
    ageConfirmed: boolean,
  ): Promise<ProfileError | null>;
}

export function mapProfileError(message: string): ProfileError {
  if (message.includes("name-invalid")) return "name-invalid";
  if (message.includes("name-taken")) return "name-taken";
  if (message.includes("age-required")) return "age-required";
  return "unavailable";
}

/** Reads a failed sign-in out of the address Supabase returns to, then removes it. */
function takeReturnedError(): string | undefined {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const description =
    url.searchParams.get("error_description") ?? hash.get("error_description");
  if (!description && !url.searchParams.has("error") && !hash.has("error")) {
    return undefined;
  }
  window.history.replaceState(null, "", url.pathname);
  return "Google sign-in didn't finish. Your game on this device is safe, so please try again.";
}

// supabase-js loads separately, so playing offline never depends on it.
export function createAccountService(config: OnlineConfig): AccountService {
  let client: Promise<SupabaseClient> | null = null;
  let returnedError = takeReturnedError();
  let republish: (() => Promise<void>) | null = null;
  const getClient = () => {
    client ??= import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(config.url, config.publishableKey, {
        auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
      }),
    );
    return client;
  };

  async function readProfile(supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, age_confirmed_at")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      displayName: data.display_name as string | null,
      ageConfirmed: data.age_confirmed_at !== null,
    };
  }

  return {
    subscribe(listener) {
      let active = true;
      let unsubscribe = () => undefined as void;
      const publish = async (
        supabase: SupabaseClient,
        user: { id: string; email?: string } | null,
      ) => {
        if (!user) {
          if (active) {
            listener({ kind: "signed-out", error: returnedError });
            returnedError = undefined;
          }
          return;
        }
        const profile = await readProfile(supabase, user.id);
        if (active) listener({ kind: "signed-in", email: user.email ?? "", profile });
      };
      listener({ kind: "loading" });
      getClient()
        .then(async (supabase) => {
          if (!active) return;
          const { data } = supabase.auth.onAuthStateChange((event, session) => {
            // Calling Supabase inside this callback can deadlock its auth lock.
            if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
              const user = session?.user ?? null;
              republish = () => publish(supabase, user);
              setTimeout(() => void publish(supabase, user), 0);
            }
          });
          unsubscribe = () => data.subscription.unsubscribe();
        })
        .catch(() => {
          // The online code couldn't load, most likely with no connection.
          if (active) listener({ kind: "signed-out" });
        });
      return () => {
        active = false;
        unsubscribe();
      };
    },
    async signIn() {
      const supabase = await getClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    },
    async signOut() {
      const supabase = await getClient();
      // Only this device. The game saved here is deliberately left alone.
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    },
    async completeProfile(displayName, ageConfirmed) {
      const supabase = await getClient();
      const { error } = await supabase.rpc("complete_profile", {
        p_display_name: displayName,
        p_age_confirmed: ageConfirmed,
      });
      if (error) return mapProfileError(error.message);
      await republish?.();
      return null;
    },
  };
}
