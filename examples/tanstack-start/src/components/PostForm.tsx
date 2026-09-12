import { useState, type FormEvent } from "react";

import type { PostInput } from "../types.js";

interface PostFormProps {
  initial?: PostInput;
  submitLabel: string;
  onSubmit: (input: PostInput) => Promise<void>;
  onCancel?: () => void;
}

export function PostForm({ initial, submitLabel, onSubmit, onCancel }: PostFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ title, body });
      if (initial === undefined) {
        setTitle("");
        setBody("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="post-form" onSubmit={(event) => void submit(event)}>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Title"
        required
      />
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Text"
        rows={3}
      />
      <div className="row">
        <button type="submit" disabled={busy}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
