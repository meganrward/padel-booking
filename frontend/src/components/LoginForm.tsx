import { useState } from "react";
import { signInWithPassword } from "../lib/preferences";
import { Banner, Card, Field, Spinner } from "./ui";

interface Props {
  onSignedIn: () => void;
}

export function LoginForm({ onSignedIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithPassword(email, password);
      onSignedIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card title="Log in" description="Log in to choose which alerts you get.">
      <form className="form" onSubmit={handleSubmit}>
        {error && <Banner tone="error">{error}</Banner>}
        <Field label="Email">
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password">
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={submitting} aria-busy={submitting || undefined}>
          {submitting && <Spinner />}
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </Card>
  );
}
