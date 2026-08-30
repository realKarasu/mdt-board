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
        <h2 id="import-title">Importer MDT</h2>
        <p>Colle une chaîne exportée par Mythic Dungeon Tools (`!…` ou `!~MDT2~…`).</p>
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
            Annuler
          </button>
          <button type="button" className="btn primary" onClick={() => onImport(text)}>
            Importer
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
        <h2 id="export-title">Exporter</h2>
        <p>{warning}</p>
        <label>Chaîne MDT (meilleur effort)</label>
        <textarea readOnly value={mdt} rows={4} />
        <label>Sauvegarde JSON</label>
        <textarea readOnly value={json} rows={6} />
        <div className="actions">
          <button type="button" className="btn" onClick={() => void copy("mdt", mdt)}>
            {copied === "mdt" ? "MDT copiée" : "Copier MDT"}
          </button>
          <button type="button" className="btn" onClick={() => void copy("json", json)}>
            {copied === "json" ? "JSON copié" : "Copier JSON"}
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
