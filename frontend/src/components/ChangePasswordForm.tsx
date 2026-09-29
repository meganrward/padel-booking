import { useState } from "react";
import { updateOwnPassword } from "../lib/preferences";
import { Banner, Card, Field, Spinner } from "./ui";

export function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      await updateOwnPassword(newPassword);
      setSuccess(true);
      setNewPassword("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="page-footer">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          Change password
        </button>
      </div>
    );
  }

  return (
    <Card
      title="Change password"
      actions={
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      }
    >
      <form className="form" onSubmit={handleSubmit}>
        {error && <Banner tone="error">{error}</Banner>}
        {success && <Banner tone="success">Password updated.</Banner>}
        <Field label="New password">
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={submitting} aria-busy={submitting || undefined}>
          {submitting && <Spinner />}
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>
    </Card>
  );
}
