import { useEffect, useMemo, useState } from "react";
import { BoardMode } from "./components/BoardMode";
import { ExportDialog, ImportDialog } from "./components/Dialogs";
import { EditorMode } from "./components/EditorMode";
import { Picker } from "./components/Picker";
import { dungeonSummaries, getDungeon } from "./lib/dungeons";
import { MdtDecodeError } from "./lib/mdt/codec";
import { encodeRoute, parseIncomingRoute, routeToJsonBackup } from "./lib/mdt/preset";
import {
  addPull,
  createRoute,
  deletePull,
  movePull,
  setCurrentPull,
  toggleClone,
} from "./lib/route";
import { deleteSavedRoute, listSavedRoutes, saveRoute } from "./lib/storage";
import type { AppMode, Route } from "./types";
import sampleMdt from "../fixtures/altar-of-fangs.mdt?raw";

export default function App() {
  const [mode, setMode] = useState<AppMode>("picker");
  const [route, setRoute] = useState<Route | null>(null);
  const [saved, setSaved] = useState(listSavedRoutes);
  const [showPath, setShowPath] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const dungeon = route ? getDungeon(route.dungeonIdx) : undefined;

  const exportPayload = useMemo(() => {
    if (!route) return null;
    return {
      mdt: encodeRoute(route),
      json: JSON.stringify(routeToJsonBackup(route), null, 2),
    };
  }, [route]);

  function refreshSaved() {
    setSaved(listSavedRoutes());
  }

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  function openRoute(next: Route, nextMode: AppMode) {
    setRoute(next);
    setMode(nextMode);
  }

  function persist(next: Route) {
    setRoute(next);
    saveRoute(next);
    refreshSaved();
  }

  function handleImport(raw: string) {
    try {
      const imported = parseIncomingRoute(raw);
      if (!getDungeon(imported.dungeonIdx)) {
        throw new MdtDecodeError(
          `Donjon MDT ${imported.dungeonIdx} hors pool S2. Vérifie que la chaîne vient d'un donjon Midnight S2.`,
        );
      }
      persist(imported);
      setImportOpen(false);
      setImportError(null);
      setMode("board");
      flash("Route importée");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import impossible");
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (importOpen || exportOpen) {
        if (e.key === "Escape") {
          setImportOpen(false);
          setExportOpen(false);
        }
        return;
      }
      if (!route) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (mode === "board") {
        if (e.key === "Escape") {
          setMode("editor");
          return;
        }
        if (e.key === "ArrowRight" || e.key === "j" || e.key === "J") {
          e.preventDefault();
          setRoute(setCurrentPull(route, route.currentPull + 1));
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "k" || e.key === "K") {
          e.preventDefault();
          setRoute(setCurrentPull(route, route.currentPull - 1));
          return;
        }
        if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
          else void document.exitFullscreen();
          return;
        }
        if (/^[1-9]$/.test(e.key)) {
          setRoute(setCurrentPull(route, Number(e.key)));
        }
      } else if (mode === "editor" && e.key === "Escape") {
        setMode("picker");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [route, mode, importOpen, exportOpen]);

  return (
    <div className="app">
      {mode === "picker" && (
        <Picker
          dungeons={dungeonSummaries}
          saved={saved}
          onNew={(idx) => {
            const d = getDungeon(idx);
            openRoute(createRoute(idx, d ? `${d.shortFr} · Blood DK` : "Nouvelle route"), "editor");
          }}
          onOpen={(r) => openRoute(r, "board")}
          onDelete={(id) => {
            deleteSavedRoute(id);
            refreshSaved();
          }}
          onImport={() => {
            setImportError(null);
            setImportOpen(true);
          }}
          onSample={() => handleImport(sampleMdt)}
        />
      )}

      {mode === "editor" && route && dungeon && (
        <EditorMode
          dungeon={dungeon}
          route={route}
          showPath={showPath}
          onName={(name) => persist({ ...route, name, updatedAt: Date.now() })}
          onTogglePath={() => setShowPath((v) => !v)}
          onSelectPull={(n) => setRoute(setCurrentPull(route, n))}
          onToggleClone={(ref) => persist(toggleClone(route, ref))}
          onAddPull={() => persist(addPull(route))}
          onDeletePull={(i) => persist(deletePull(route, i))}
          onMovePull={(from, to) => persist(movePull(route, from, to))}
          onNote={(i, note) => {
            const pulls = route.pulls.map((p, idx) => (idx === i ? { ...p, note } : p));
            persist({ ...route, pulls, updatedAt: Date.now() });
          }}
          onFloor={(floor) => setRoute({ ...route, currentSublevel: floor })}
          onBoard={() => setMode("board")}
          onImport={() => {
            setImportError(null);
            setImportOpen(true);
          }}
          onExport={() => setExportOpen(true)}
          onSave={() => {
            persist(route);
            flash("Route sauvée en local");
          }}
          onHome={() => setMode("picker")}
        />
      )}

      {mode === "board" && route && dungeon && (
        <BoardMode
          dungeon={dungeon}
          route={route}
          showPath={showPath}
          onSelectPull={(n) => setRoute(setCurrentPull(route, n))}
          onEditor={() => setMode("editor")}
        />
      )}

      {importOpen && (
        <ImportDialog
          error={importError}
          onClose={() => setImportOpen(false)}
          onImport={handleImport}
        />
      )}

      {exportOpen && exportPayload && (
        <ExportDialog
          mdt={exportPayload.mdt}
          json={exportPayload.json}
          warning="JSON = sauvegarde complète. La chaîne MDT reprend donjon, pulls et notes. Dessins / objets MDT non réexportés."
          onClose={() => setExportOpen(false)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
