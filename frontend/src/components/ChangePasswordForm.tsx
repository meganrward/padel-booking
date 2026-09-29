import { useState } from "react";
import { updateOwnPassword } from "../lib/preferences";

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
      <button type="button" className="change-password-toggle" onClick={() => setOpen(true)}>
        Change password
      </button>
    );
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <h2>Change password</h2>
      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">Password updated.</div>}
      <input
        type="password"
        placeholder="New password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={submitting}>
        {submitting ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
