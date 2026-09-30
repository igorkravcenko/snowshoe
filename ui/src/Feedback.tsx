import { type ReactElement, useEffect, useState } from "react";
import { type FeedbackEntry, fetchFeedback } from "./api.ts";

function formatWhen(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return iso;
  return new Date(d).toLocaleString();
}

export function FeedbackPane(props: { active: boolean }): ReactElement {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.active) return;
    let cancelled = false;
    const load = async () => {
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
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [props.active]);

  if (error) {
    return (
      <div className="feedback-pane">
        <p className="feedback-empty">{error}</p>
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="feedback-pane">
        <p className="feedback-empty">No local notes yet. Optional: snowshoe feedback add --json</p>
      </div>
    );
  }
  return (
    <div className="feedback-pane">
      <ul className="feedback-list">
        {entries.map((e) => (
          <li key={e.id} className="feedback-item">
            <time dateTime={e.createdAt}>{formatWhen(e.createdAt)}</time>
            {e.command ? <code className="feedback-cmd">{e.command}</code> : null}
            <pre className="feedback-text">{e.text}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
