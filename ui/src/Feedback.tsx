import { type FormEvent, type ReactElement, useCallback, useEffect, useState } from "react";
import { addFeedback, type FeedbackEntry, fetchFeedback, removeFeedback } from "./api.ts";

function formatWhen(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return iso;
  return new Date(d).toLocaleString();
}

export function FeedbackPane(props: { active: boolean }): ReactElement {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await fetchFeedback();
      setEntries(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (!props.active) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await fetchFeedback();
        if (!cancelled) {
          setEntries(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [props.active]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addFeedback(trimmed);
      setText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await removeFeedback(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="feedback-pane">
      <form className="feedback-form" onSubmit={(ev) => void onSubmit(ev)}>
        <label className="feedback-label" htmlFor="feedback-text">
          Local note
        </label>
        <textarea
          id="feedback-text"
          className="feedback-input"
          rows={3}
          value={text}
          disabled={busy}
          placeholder="Unclear, frustrating, or a concrete idea…"
          onChange={(ev) => setText(ev.target.value)}
        />
        <button type="submit" className="primary" disabled={busy || !text.trim()}>
          Add
        </button>
      </form>
      {error ? <p className="feedback-empty">{error}</p> : null}
      {entries.length === 0 ? (
        <p className="feedback-empty">No local notes yet.</p>
      ) : (
        <ul className="feedback-list">
          {entries.map((entry) => (
            <li key={entry.id} className="feedback-item">
              <div className="feedback-item-head">
                <time dateTime={entry.createdAt}>{formatWhen(entry.createdAt)}</time>
                <button
                  type="button"
                  className="danger feedback-remove"
                  disabled={busy}
                  onClick={() => void onRemove(entry.id)}
                >
                  Delete
                </button>
              </div>
              {entry.command ? <code className="feedback-cmd">{entry.command}</code> : null}
              <pre className="feedback-text">{entry.text}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
