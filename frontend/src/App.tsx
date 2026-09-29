import { useEffect, useState } from "react";
import { api } from "./api";
import { fetchOwnPreferences, getCurrentUser, signOut, updateOwnPreferences, type Preferences } from "./lib/preferences";
import { ChangePasswordForm } from "./components/ChangePasswordForm";
import { FreeCourtFinder } from "./components/FreeCourtFinder";
import { LoginForm } from "./components/LoginForm";
import { PreferencesEditor } from "./components/PreferencesEditor";
import "./App.css";

export function App() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [instructors, setInstructors] = useState<string[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadPreferences() {
    const user = await getCurrentUser();
    if (!user) {
      setSignedIn(false);
      setPreferences(null);
      return;
    }
    setSignedIn(true);
    setPreferences(await fetchOwnPreferences());
    // The instructor list comes from the separate search-service backend, which may not
    // be reachable — that shouldn't block editing preferences, so it fails silently here.
    try {
      setInstructors(await api.listInstructors());
    } catch {
      setInstructors([]);
    }
  }

  useEffect(() => {
    loadPreferences()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSignedIn() {
    setLoading(true);
    setError(null);
    try {
      await loadPreferences();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setSignedIn(false);
    setPreferences(null);
  }

  async function handlePreferencesChange(patch: Partial<Preferences>) {
    if (!preferences) return;
    const previous = preferences;
    setPreferences({ ...preferences, ...patch });
    try {
      const updated = await updateOwnPreferences(patch);
      setPreferences(updated);
    } catch (e) {
      setError((e as Error).message);
      setPreferences(previous);
    }
  }

  if (loading) return <div className="page">Loading...</div>;

  return (
    <div className="page">
      <h1>Padel Court Finder</h1>
      {error && <div className="error-banner">{error}</div>}

      <FreeCourtFinder />

      {signedIn && preferences ? (
        <>
          <PreferencesEditor preferences={preferences} instructors={instructors} onChange={handlePreferencesChange} />
          <ChangePasswordForm />
          <button type="button" onClick={handleSignOut}>
            Log out
          </button>
        </>
      ) : (
        <LoginForm onSignedIn={handleSignedIn} />
      )}
    </div>
  );
}
