import { useState } from "react";

type ImportProps = {
  error: string | null;
  onClose: () => void;
  onImport: (raw: string) => void;
};

export function ImportDialog({ error, onClose, onImport }: ImportProps) {
  const [text, setText] = useState("");
  return (
    <div className="modal" role="dialog" aria-labelledby="import-title">
      <div className="sheet">
        <h2 id="import-title">Import MDT</h2>
        <p>Paste a string exported by Mythic Dungeon Tools (`!…` or `!~MDT2~…`).</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="!...."
          rows={8}
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={() => onImport(text)}>
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

type ExportProps = {
  mdt: string;
  json: string;
  warning: string;
  onClose: () => void;
};

export function ExportDialog({ mdt, json, warning, onClose }: ExportProps) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
  }

  return (
    <div className="modal" role="dialog" aria-labelledby="export-title">
      <div className="sheet">
        <h2 id="export-title">Export</h2>
        <p>{warning}</p>
        <label>MDT string (best effort)</label>
        <textarea readOnly value={mdt} rows={4} />
        <label>JSON backup</label>
        <textarea readOnly value={json} rows={6} />
        <div className="actions">
          <button type="button" className="btn" onClick={() => void copy("mdt", mdt)}>
            {copied === "mdt" ? "MDT copied" : "Copy MDT"}
          </button>
          <button type="button" className="btn" onClick={() => void copy("json", json)}>
            {copied === "json" ? "JSON copied" : "Copy JSON"}
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
