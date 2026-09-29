import { useId, useState, type ReactNode } from "react";

/* Small building blocks from the Padel Court Finder design system. */

export function Card({
  title,
  description,
  actions,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      {(title || description || actions) && (
        <div className="card-head">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {description && <p className="card-desc">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

const BANNER = {
  error: { mark: "!", word: "Error", role: "alert" },
  success: { mark: "✓", word: "Done", role: "status" },
} as const;

export function Banner({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const b = BANNER[tone];
  return (
    <div className={`banner banner-${tone}`} role={b.role}>
      <span className="banner-mark" aria-hidden="true">
        {b.mark}
      </span>
      <div>
        <span className="banner-title">{b.word}</span>{" "}
        {children}
      </div>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  // The label wraps its control so getByLabelText / clicking the label both work;
  // the hint sits outside it so it isn't read as part of the field's name.
  return (
    <div className="field">
      <label className="field-control">
        <span className="field-label">{label}</span>
        {children}
      </label>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function Chip({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="chip">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="chip-tick" aria-hidden="true" />
      {label}
    </label>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="segmented">
      <legend className="visually-hidden">{label}</legend>
      {options.map((o) => (
        <label key={o.value} className="segment">
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Topic({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the topic is still selectable */
    }
  }
  return (
    <div className="topic">
      <code>{value}</code>
      <button type="button" className="copy-btn" onClick={copy} aria-live="polite">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
