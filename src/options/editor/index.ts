import { openSearchPanel } from "@codemirror/search";
import { showAlert } from "./ui/feedback";
import {
  deleteThemeBtn,
  editThemeBtn,
  themeModalClose,
  themeModalOverlay,
  themeSelectorBtn,
  themeNameText,
  openEditCSS,
  openOptions,
} from "./ui/dom";
import { createEditorState, createEditorView } from "./core/editor";
import { generateDefaultFilename, saveCSSToFile, importManager } from "./features/import";
import { editorStateManager } from "./core/state";
import { storageManager } from "./features/storage";
import {
  closeThemeModal,
  handleDeleteTheme,
  handleRenameTheme,
  handleSaveTheme,
  openThemeModal,
  saveToStorage,
  setThemeName,
  initStoreThemeListener,
} from "./features/themes";

export function initializeNavigation() {
  document.getElementById("edit-css-btn")?.addEventListener("click", openEditCSS);
  document.getElementById("back-btn")?.addEventListener("click", openOptions);

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveToStorage();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      let view = editorStateManager.getEditor();
      if (view) {
        openSearchPanel(view);
      }
      e.preventDefault();
    }
  });
}

export function initializeThemeModal() {
  themeSelectorBtn?.addEventListener("click", openThemeModal);

  themeModalClose?.addEventListener("click", closeThemeModal);

  themeModalOverlay?.addEventListener("click", e => {
    if (e.target === themeModalOverlay) {
      closeThemeModal();
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && themeModalOverlay?.classList.contains("active")) {
      closeThemeModal();
    }
  });
}

export function initializeThemeActions() {
  document.getElementById("save-theme-btn")?.addEventListener("click", handleSaveTheme);

  deleteThemeBtn?.addEventListener("click", handleDeleteTheme);

  editThemeBtn?.addEventListener("click", handleRenameTheme);
  themeNameText?.addEventListener("click", handleRenameTheme);
}

export function initializeFileOperations() {
  document.getElementById("file-import-btn")?.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".css";
    input.onchange = async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        await importManager.importCSSFile(file);
      } catch (err) {
        console.error("[BetterLyrics] File import error:", err);
      }
    };
    input.click();
  });

  document.getElementById("file-export-btn")?.addEventListener("click", async () => {
    const editor = editorStateManager.getEditor();
    if (!editor) {
      showAlert("Editor not initialized!");
      return;
    }

    const css = editor.state.doc.toString();
    if (!css) {
      showAlert("No styles to export!");
      return;
    }

    const defaultFilename = generateDefaultFilename();
    saveCSSToFile(css, defaultFilename);
  });
}

export function initializeStorageListeners() {
  storageManager.initialize();
}

export async function initializeEditor() {
  console.log("[BetterLyrics] DOM loaded, initializing editor");

  const editorElement = document.getElementById("editor")!;
  const isStandalone = document.querySelector(".theme-name-display.standalone") !== null;
  const initialEditor = createEditorView(
    createEditorState("Loading...", { enableSearch: isStandalone }),
    editorElement
  );

  editorStateManager.setEditor(initialEditor);

  const openStandaloneEditor = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("pages/standalone-editor.html"),
    });
  };

  document.getElementById("editor-popout-button")?.addEventListener("click", openStandaloneEditor);
  document.getElementById("editor-popout-link")?.addEventListener("click", e => {
    e.preventDefault();
    openStandaloneEditor();
  });

  console.log("[BetterLyrics] Loading theme name and initial CSS");

  const setSelectedThemePromise = setThemeName();
  const loadCustomCssPromise = storageManager.loadInitialCSS();

  await Promise.allSettled([setSelectedThemePromise, loadCustomCssPromise]);

  console.log("[BetterLyrics] Editor initialization complete");
}

export function initialize() {
  document.addEventListener("DOMContentLoaded", async () => {
    await initializeEditor();
    initializeNavigation();
    initializeThemeModal();
    initializeThemeActions();
    initializeFileOperations();
    initializeStorageListeners();
    initStoreThemeListener();
  });
}
