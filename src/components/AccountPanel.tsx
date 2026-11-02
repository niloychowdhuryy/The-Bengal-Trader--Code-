import { useState } from "react";
import type {
  AccountService,
  AccountStatus,
  PlayerProfile,
  ProfileError,
} from "../online/account";

const PROFILE_MESSAGES: Record<ProfileError, string> = {
  "name-invalid": "Use 2 to 24 letters or numbers. Spaces, hyphens and apostrophes can go in the middle.",
  "name-taken": "Another merchant already uses that name. Please try another.",
  "age-required": "Please confirm you are 13 or older.",
  unavailable: "That couldn't be saved. Check your connection and try again.",
};

function ProfileForm({
  service,
  profile,
  onDone,
}: {
  service: AccountService;
  profile: PlayerProfile;
  onDone?: () => void;
}) {
  const [name, setName] = useState(profile.displayName ?? "");
  const [age, setAge] = useState(profile.ageConfirmed);
  const [error, setError] = useState<ProfileError | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="account-form"
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        service
          .completeProfile(name, age)
          .catch((): ProfileError => "unavailable")
          .then((result) => {
            setSaving(false);
            setError(result);
            if (!result) onDone?.();
          });
      }}
    >
      <label className="captain-field">
        <span>Your merchant name</span>
        <input
          maxLength={24}
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <p className="account-note">Other players may see this later, so avoid your full real name.</p>
      {!profile.ageConfirmed && (
        <label className="account-check">
          <input
            type="checkbox"
            checked={age}
            onChange={(event) => setAge(event.target.checked)}
          />
          I am 13 or older
        </label>
      )}
      {error && <p className="route-size-note" role="alert">{PROFILE_MESSAGES[error]}</p>}
      <button className="primary-button account-action" disabled={saving}>
        <span>{saving ? "Saving..." : "Save merchant name"}</span>
      </button>
    </form>
  );
}

export default function AccountPanel({
  service,
  status,
}: {
  service: AccountService;
  status: AccountStatus;
}) {
  const [problem, setProblem] = useState("");
  const [editing, setEditing] = useState(false);

  const attempt = (action: () => Promise<void>, message: string) => {
    setProblem("");
    action().catch(() => setProblem(message));
  };

  return (
    <section className="future-panel account-panel" aria-label="Account">
      {status.kind === "loading" && <p role="status">Checking your account...</p>}

      {status.kind === "signed-out" && (
        <>
          <h2>Sign in</h2>
          <p>
            Sign in with Google to claim your merchant name. For now, your game
            still saves only on this device. Cloud saves are coming in a later update.
          </p>
          {status.error && <p className="route-size-note" role="alert">{status.error}</p>}
          <button
            className="primary-button account-action"
            onClick={() =>
              attempt(
                service.signIn,
                "Google sign-in needs an internet connection. You can keep playing offline.",
              )
            }
          >
            <span>Sign in with Google</span>
            <span aria-hidden="true">→</span>
          </button>
        </>
      )}

      {status.kind === "signed-in" && (
        <>
          <h2>{status.profile?.displayName ?? "Welcome, merchant"}</h2>
          <p>Signed in as {status.email}</p>
          {!status.profile && (
            <p className="route-size-note" role="status">
              Your profile couldn't be reached right now. You can keep playing.
            </p>
          )}
          {status.profile && (!status.profile.displayName || editing) && (
            <ProfileForm
              key={status.profile.displayName ?? "new"}
              service={service}
              profile={status.profile}
              onDone={() => setEditing(false)}
            />
          )}
          {status.profile?.displayName && !editing && (
            <button className="account-secondary" onClick={() => setEditing(true)}>
              Change merchant name
            </button>
          )}
          <p className="account-note">
            Your game still saves only on this device. Cloud saves are coming in a later update.
          </p>
          <button
            className="account-secondary"
            onClick={() =>
              attempt(service.signOut, "Signing out didn't work. Check your connection and try again.")
            }
          >
            Sign out
          </button>
          <p className="account-note">Signing out keeps your game on this device.</p>
        </>
      )}
      {problem && <p className="route-size-note" role="alert">{problem}</p>}
    </section>
  );
}
