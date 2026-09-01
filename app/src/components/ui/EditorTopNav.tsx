import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  DownloadSimple,
  FilePlus,
  ArrowCounterClockwise,
  ArrowClockwise,
  FloppyDisk,
  FolderOpen,
  Check,
  Spinner,
  WarningCircle,
  CaretDown,
  Trash,
  Keyboard,
} from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import { useEditor } from "../../context/EditorContext";
import { UnsavedChangesModal } from "./UnsavedChangesModal";
import {
  onSaveStatus,
  saveDocument,
  saveNewProject,
  loadProject,
  fetchProjectList,
  removeProject,
  flushAutosave,
  type DocumentState,
  type SaveStatus,
} from "../../lib/persistence";
import type { ApiProject } from "../../lib/api";

interface EditorTopNavProps {
  onExport?: () => void;
  onNewProject?: () => void;
  isProjectActive?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  frameSize?: { width: number; height: number };
  /** Full document state + methods for persistence */
  documentRef?: React.MutableRefObject<DocumentState>;
}

export default function EditorTopNav({
  onExport,
  onNewProject,
  isProjectActive,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  frameSize,
  documentRef,
}: EditorTopNavProps) {
  const {
    isDirty,
    currentProjectId,
    setCurrentProjectId,
    projectName,
    setProjectName,
  } = useEditor();

  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });
  const navigate = useNavigate();
  const [openDropdown, setOpenDropdown] = useState(false);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Editable project name (A16): double-click the badge to rename inline.
  const [renamingName, setRenamingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(projectName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingName) nameInputRef.current?.select();
  }, [renamingName]);

  const commitRename = () => {
    const trimmed = nameDraft.trim();
    if (trimmed) setProjectName(trimmed);
    setRenamingName(false);
    setNameDraft(projectName);
  };

  // Subscribe to save status
  useEffect(() => {
    return onSaveStatus(setSaveStatus);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdown]);

  // ── Modal state for unsaved-changes guards ───────────────────────
  const [unsavedModalAction, setUnsavedModalAction] = useState<
    "new" | "open" | "back" | null
  >(null);
  const [pendingOpenProjectId, setPendingOpenProjectId] = useState<
    string | null
  >(null);

  const closeUnsavedModal = () => {
    setUnsavedModalAction(null);
    setPendingOpenProjectId(null);
  };

  const handleBack = (e: React.MouseEvent) => {
    if (isDirty && isProjectActive) {
      e.preventDefault();
      setUnsavedModalAction("back");
    }
  };

  const handleNew = () => {
    if (isDirty) {
      setUnsavedModalAction("new");
    } else {
      onNewProject?.();
    }
  };

  const handleSave = useCallback(async () => {
    if (!documentRef?.current) return;
    const doc = documentRef.current;

    if (!currentProjectId) {
      // First save: prompt for a name
      const name = window.prompt("Project name:", projectName);
      if (!name) return;
      setProjectName(name);
      const pid = await saveNewProject(name, doc);
      setCurrentProjectId(pid);
    } else {
      await saveDocument(doc, projectName);
    }
  }, [documentRef, currentProjectId, projectName, setCurrentProjectId, setProjectName]);

  const handleOpen = useCallback(async () => {
    setOpenDropdown(!openDropdown);
    if (!openDropdown && projects.length === 0) {
      setLoadingProjects(true);
      try {
        const list = await fetchProjectList();
        setProjects(list);
      } catch {
        // silently fail
      } finally {
        setLoadingProjects(false);
      }
    }
  }, [openDropdown, projects.length]);

  const handleLoadProject = useCallback(
    async (projectId: string) => {
      setOpenDropdown(false);

      if (isDirty) {
        setPendingOpenProjectId(projectId);
        setUnsavedModalAction("open");
        return;
      }

      // Flush any pending autosave first
      if (documentRef?.current) {
        await flushAutosave(documentRef.current);
      }

      const result = await loadProject(projectId);
      if (!result) return;

      // Use the window event bus to signal project load
      window.dispatchEvent(
        new CustomEvent("load-project", { detail: result }),
      );
    },
    [documentRef, isDirty],
  );

  const handleDeleteProject = useCallback(
    async (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      if (!window.confirm("Delete this project?")) return;
      await removeProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    },
    [],
  );

  const dimensionsLabel = frameSize
    ? `${frameSize.width} × ${frameSize.height}`
    : "draft";

  // Save status UI
  const statusIcon = () => {
    switch (saveStatus.kind) {
      case "saving":
        return <Spinner className="w-3 h-3 animate-spin text-zinc-400" />;
      case "saved":
        return <Check className="w-3 h-3 text-green-400" />;
      case "error":
        return (
          <span title={saveStatus.message}>
            <WarningCircle className="w-3 h-3 text-red-400" />
          </span>
        );
      default:
        return isDirty ? (
          <span className="w-2 h-2 rounded-full bg-amber-400/80" title="Unsaved changes" />
        ) : null;
    }
  };

  // ── Modal action handlers ─────────────────────────────────────────
  const handleModalSaveAndContinue = async () => {
    if (unsavedModalAction === "back") {
      await handleSave();
      closeUnsavedModal();
      navigate("/");
    } else if (unsavedModalAction === "new") {
      await handleSave();
      closeUnsavedModal();
      onNewProject?.();
    } else if (unsavedModalAction === "open" && pendingOpenProjectId) {
      await handleSave();
      closeUnsavedModal();
      await handleLoadProject(pendingOpenProjectId);
    }
  };

  const handleModalDiscard = async () => {
    if (unsavedModalAction === "back") {
      closeUnsavedModal();
      navigate("/");
    } else if (unsavedModalAction === "new") {
      closeUnsavedModal();
      onNewProject?.();
    } else if (unsavedModalAction === "open" && pendingOpenProjectId) {
      const projectId = pendingOpenProjectId;
      closeUnsavedModal();
      // Flush and load without saving
      if (documentRef?.current) {
        await flushAutosave(documentRef.current);
      }
      const result = await loadProject(projectId);
      if (result) {
        window.dispatchEvent(
          new CustomEvent("load-project", { detail: result }),
        );
      }
    }
  };

  const modalTitle =
    unsavedModalAction === "new"
      ? "Start New Project?"
      : unsavedModalAction === "open"
        ? "Open Another Project?"
        : "Leave Editor?";

  const modalDescription =
    unsavedModalAction === "new"
      ? "Your current canvas will be cleared."
      : unsavedModalAction === "open"
        ? "Loading another project will replace your current canvas."
        : "You have unsaved changes. Leave anyway?";

  return (
    <>
    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md z-10">
      <div className="flex items-center gap-5">
        <Link
          to="/"
          onClick={handleBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
          title="Back to home"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <img
            className="w-7 h-7"
            src="/svg-readme-logo.png"
            alt="svg-readme"
          />
          <span className="font-[Poppins] font-medium text-[15px]">
            svg-readme
          </span>
          {isProjectActive && (
            <>
              {/* Dirty/save indicator */}
              <span className="flex items-center justify-center w-4 h-4">
                {statusIcon()}
              </span>
              {renamingName ? (
                <input
                  ref={nameInputRef}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenamingName(false);
                  }}
                  aria-label="Project name"
                  className="w-40 px-2 py-0.5 rounded text-[11px] font-[JetBrains_Mono] bg-zinc-900 text-zinc-200 border border-blue-500/50 outline-none"
                />
              ) : (
                <span
                  onDoubleClick={() => {
                    setNameDraft(projectName);
                    setRenamingName(true);
                  }}
                  title="Double-click to rename"
                  className="px-2 py-0.5 rounded text-[11px] font-[JetBrains_Mono] bg-zinc-800/50 text-zinc-400 border border-white/5 hover:border-white/20 hover:text-zinc-200 transition-colors cursor-text"
                >
                  {projectName}
                </span>
              )}
              <span className="px-2 py-0.5 rounded text-[11px] font-[JetBrains_Mono] bg-zinc-800/30 text-zinc-500 border border-white/5">
                {dimensionsLabel}
              </span>
            </>
          )}
          {!isProjectActive && (
            <span className="ml-1 px-2 py-0.5 rounded text-[11px] font-[JetBrains_Mono] bg-zinc-800/50 text-zinc-400 border border-white/5">
              draft
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isProjectActive && (
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("toggle-shortcuts"))
            }
            title="Keyboard shortcuts (Ctrl+/)"
            aria-label="Keyboard shortcuts"
            className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        )}

        {isProjectActive && (
          <div className="flex items-center gap-1 mr-1" aria-label="History controls">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl/Cmd+Z)"
              className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowCounterClockwise className="w-4 h-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl/Cmd+Shift+Z)"
              className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowClockwise className="w-4 h-4" />
            </button>
          </div>
        )}

        {isProjectActive && (
          <>
            {/* Open project dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={handleOpen}
                title="Open project"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-300 hover:text-white border border-white/10 hover:bg-white/5 rounded-md transition-all duration-200"
              >
                <FolderOpen className="w-4 h-4" />
                Open
                <CaretDown className="w-3 h-3 text-zinc-500" />
              </button>

              {openDropdown && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/5">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                      Your Projects
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {loadingProjects ? (
                      <div className="px-3 py-6 text-center text-zinc-500 text-sm">
                        <Spinner className="w-4 h-4 animate-spin mx-auto mb-2" />
                        Loading...
                      </div>
                    ) : projects.length === 0 ? (
                      <div className="px-3 py-6 text-center text-zinc-500 text-sm">
                        No saved projects yet
                      </div>
                    ) : (
                      projects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleLoadProject(p.id)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/5 transition-colors group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-zinc-200 truncate">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {p.canvasWidth}×{p.canvasHeight}
                              {" · "}
                              {new Date(p.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleDeleteProject(e, p.id)}
                            className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete project"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saveStatus.kind === "saving"}
              title={currentProjectId ? "Save (Ctrl+S)" : "Save As..."}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white border border-white/10 hover:bg-white/5 rounded-md transition-all duration-200 disabled:opacity-50"
            >
              <FloppyDisk className="w-4 h-4" />
              {currentProjectId ? "Save" : "Save As"}
            </button>
          </>
        )}

        {isProjectActive && (
          <button
            onClick={handleNew}
            title="New Project"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white border border-white/10 hover:bg-white/5 rounded-md transition-all duration-200"
          >
            <FilePlus className="w-4 h-4" />
            New
          </button>
        )}

        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all duration-200 border border-blue-500/50"
        >
          <DownloadSimple className="w-4 h-4" />
          Export SVG
        </button>
      </div>
    </header>

    <UnsavedChangesModal
      open={unsavedModalAction !== null}
      onClose={closeUnsavedModal}
      onDiscard={handleModalDiscard}
      onSaveAndContinue={handleModalSaveAndContinue}
      title={modalTitle}
      description={modalDescription}
    />
    </>
  );
}
