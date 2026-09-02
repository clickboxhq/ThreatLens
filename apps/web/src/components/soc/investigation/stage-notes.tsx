import { useState } from "react";
import { Panel } from "@/components/soc/primitives";
import type { NoteDto } from "@/types/threatlens-investigation";

// Quick-insert prefixes — a lightweight authoring aid, not a structured-notes schema. The
// backend note shape is just {id, body, createdAt} (see evidence-notes.service.ts's createNote)
// with no type field, so this stays free text; these just help start the sentence.
const PREFIXES = ["Observation:", "Analysis:", "Hypothesis:", "Conclusion:"];

/**
 * Analyst Notes as a real workspace — the case notebook, not a textarea wedged into a sidebar.
 */
export function StageNotes({
  notes,
  locked,
  onAddNote,
}: {
  notes: NoteDto[];
  locked: boolean;
  onAddNote: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Panel title="Case notebook" padded={false}>
        {notes.length === 0 ? (
          <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
            Your working memory for this investigation. Not graded, but retained for review — write
            down what you're seeing and why, as you go.
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {notes.map((n) => (
              <li key={n.id} className="px-4 py-3.5">
                <div className="text-[10.5px] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-secondary">
                  {n.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Add a note">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PREFIXES.map((p) => (
            <button
              key={p}
              disabled={locked}
              onClick={() => setDraft((d) => (d ? `${d}\n\n${p} ` : `${p} `))}
              className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-secondary hover:text-foreground disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          disabled={locked}
          placeholder="What are you seeing, how do you know, what does it mean…"
          className="w-full resize-none rounded-md border border-border bg-background p-2.5 text-[12.5px] leading-relaxed focus:outline-none disabled:opacity-40"
        />
        <button
          disabled={locked || !draft.trim()}
          onClick={() => {
            onAddNote(draft.trim());
            setDraft("");
          }}
          className="mt-2 h-9 w-full rounded-md bg-primary text-[12.5px] font-medium text-primary-foreground disabled:opacity-40"
        >
          Save note
        </button>
      </Panel>
    </div>
  );
}
