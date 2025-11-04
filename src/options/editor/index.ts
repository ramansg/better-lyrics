import { showAlert } from "./alerts";
import {
  deleteThemeBtn,
  editThemeBtn,
  themeModalClose,
  themeModalOverlay,
  themeSelectorBtn,
  themeNameText,
} from "./dom";
import { createEditorState, createEditorView } from "./core";
import { generateDefaultFilename, loadCSSFromFile, saveCSSToFile } from "./file-operations";
import { openEditCSS, openOptions } from "./navigation";
import { decrementSaveCount, getSaveCount, setCurrentThemeName, setEditor, setIsUserTyping } from "./state";
import { loadCustomCSS } from "./storage";
import {
  closeThemeModal,
  handleDeleteTheme,
  handleRenameTheme,
  handleSaveTheme,
  openThemeModal,
  saveToStorage,
  setThemeName,
} from "./themes";

export function initializeNavigation() {
  document.getElementById("edit-css-btn")?.addEventListener("click", openEditCSS);
  document.getElementById("back-btn")?.addEventListener("click", openOptions);

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveToStorage();
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
      const file = (event.target as HTMLInputElement).files?.[0]!;
      try {
        const css = await loadCSSFromFile(file);
        const { editor } = await import("./state");
        editor.setState(createEditorState(css as string));

        setCurrentThemeName(null);
        chrome.storage.sync.remove("themeName");
        const { hideThemeName } = await import("./themes");
        hideThemeName();

        setIsUserTyping(false);
        saveToStorage();

        showAlert(`CSS file "${file.name}" imported!`);
      } catch (err) {
        console.error("Error reading CSS file:", err);
        showAlert("Error reading CSS file! Please try again.");
      }
    };
    input.click();
  });

  document.getElementById("file-export-btn")?.addEventListener("click", async () => {
    const { editor } = await import("./state");
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
  chrome.storage.onChanged.addListener(async (changes, namespace) => {
    console.log("storage", changes, namespace);
    if (Object.hasOwn(changes, "customCSS")) {
      if (getSaveCount() === 0) {
        const css = await loadCustomCSS();
        const { editor } = await import("./state");
        console.log("Got a CSS Update");
        editor.setState(createEditorState(css));
      }
      decrementSaveCount();
    }

    if (Object.hasOwn(changes, "themeName")) {
      console.log("Got a Theme Name Update");
      await setThemeName();
    }
  });
}

export async function initializeEditor() {
  console.log("DOM loaded");
  const editorElement = document.getElementById("editor")!;
  const initialEditor = createEditorView(createEditorState("Loading..."), editorElement);
  setEditor(initialEditor);

  document.getElementById("editor-popout-button")?.addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("pages/standalone-editor.html"),
    });
  });

  const setSelectedThemePromise = setThemeName();

  const loadCustomCssPromise = loadCustomCSS().then(async result => {
    console.log("Loaded Custom CSS:", result);
    const { editor } = await import("./state");
    editor.setState(createEditorState(result));
  });

  await Promise.allSettled([setSelectedThemePromise, loadCustomCssPromise]);
}

export function initialize() {
  document.addEventListener("DOMContentLoaded", async () => {
    await initializeEditor();
    initializeNavigation();
    initializeThemeModal();
    initializeThemeActions();
    initializeFileOperations();
    initializeStorageListeners();
  });
}
