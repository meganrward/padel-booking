import { useEffect, useState } from "react";
import { api } from "./api";
import { fetchOwnPreferences, getCurrentUser, signOut, updateOwnPreferences, type Preferences } from "./lib/preferences";
import { ChangePasswordForm } from "./components/ChangePasswordForm";
import { FreeCourtFinder } from "./components/FreeCourtFinder";
import { LoginForm } from "./components/LoginForm";
import { PreferencesEditor } from "./components/PreferencesEditor";
import { Banner, TabBar } from "./components/ui";
import bundledInstructors from "./data/instructors.json";
import "./App.css";

export function App() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  // Seeded from a bundled one-time scrape so the dropdown works even when the
  // search-service backend (Render free tier, can be asleep/unreachable) can't
  // be reached; a successful live fetch below just refreshes it.
  const [instructors, setInstructors] = useState<string[]>(bundledInstructors);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Mobile only: which half of the page is showing. Wider screens show both, stacked.
  const [tab, setTab] = useState<"find" | "account">("find");

  function selectTab(next: "find" | "account") {
    setTab(next);
    window.scrollTo({ top: 0 });
  }

  async function loadPreferences() {
    const user = await getCurrentUser();
    if (!user) {
      setSignedIn(false);
      setPreferences(null);
      return;
    }
    setSignedIn(true);
    setPreferences(await fetchOwnPreferences());
    // Try to refresh the bundled instructor list from the live search-service backend,
    // which may not be reachable — that shouldn't block editing preferences, and the
    // bundled list from the last scrape is a fine fallback, so failures are silent here.
    try {
      setInstructors(await api.listInstructors());
    } catch {
      // keep the bundled list
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

  if (loading) return <div className="page page-loading">Loading…</div>;

  const accountLabel = signedIn && preferences ? "My alerts" : "Log in";

  return (
    <main className="page" data-tab={tab}>
      <h1 className="page-title">Padel Court Finder</h1>
      {error && <Banner tone="error">{error}</Banner>}

      <div className="pane pane-find" id="pane-find">
        <FreeCourtFinder />
      </div>

      <div className="pane pane-account" id="pane-account">
        {signedIn && preferences ? (
          <>
            <PreferencesEditor preferences={preferences} instructors={instructors} onChange={handlePreferencesChange} />
            <ChangePasswordForm />
            <div className="page-footer">
              <button type="button" className="btn btn-quiet" onClick={handleSignOut}>
                Log out
              </button>
            </div>
          </>
        ) : (
          <LoginForm onSignedIn={handleSignedIn} />
        )}
      </div>

      <TabBar
        value={tab}
        onChange={selectTab}
        tabs={[
          { value: "find", label: "Find courts", controls: "pane-find" },
          { value: "account", label: accountLabel, controls: "pane-account" },
        ]}
      />
    </main>
  );
}
