import type { ThemeCardOptions } from "../types";
import THEMES, { deleteCustomTheme, getCustomThemes, renameCustomTheme, saveCustomTheme } from "../../themes";
import { SAVE_CUSTOM_THEME_DEBOUNCE, SAVE_DEBOUNCE_DELAY } from "../core/editor";
import { editorStateManager } from "../core/state";
import {
  deleteThemeBtn,
  editThemeBtn,
  syncIndicator,
  themeModalGrid,
  themeModalOverlay,
  themeSelectorBtn,
  themeNameDisplay,
  themeNameText,
} from "../ui/dom";
import { showAlert, showConfirm, showPrompt } from "../ui/feedback";
import { saveToStorageWithFallback, sendUpdateMessage, showSyncError, showSyncSuccess } from "./storage";
import { getInstalledTheme } from "../../store/themeStoreManager";

const STORE_THEME_PREFIX = "store:";

export class ThemeManager {
  async applyTheme(isCustom: boolean, index: number, themeName: string): Promise<void> {
    console.log(`[ThemeManager] Applying ${isCustom ? "custom" : "built-in"} theme: ${themeName}`);

    try {
      if (isCustom) {
        await this.applyCustomTheme(index);
      } else {
        await this.applyBuiltInTheme(index);
      }
    } catch (error) {
      console.error(`[ThemeManager] Failed to apply theme:`, error);
      showAlert("Error applying theme! Please try again.");
      throw error;
    }
  }

  private async applyCustomTheme(index: number): Promise<void> {
    const customThemes = await getCustomThemes();
    const selectedTheme = customThemes[index];

    if (!selectedTheme) {
      throw new Error(`Custom theme at index ${index} not found`);
    }

    const themeContent = `/* ${selectedTheme.name}, a custom theme for BetterLyrics */\n\n${selectedTheme.css}\n`;

    await editorStateManager.queueOperation("theme", async () => {
      console.log(`[ThemeManager] Setting custom theme: ${selectedTheme.name}`);

      await editorStateManager.setEditorContent(themeContent, `custom-theme:${selectedTheme.name}`);

      await chrome.storage.sync.set({ themeName: selectedTheme.name });
      editorStateManager.setCurrentThemeName(selectedTheme.name);
      editorStateManager.setIsCustomTheme(true);

      showThemeName(selectedTheme.name, true);
      updateThemeSelectorButton();

      await this.saveTheme(themeContent);

      showAlert(`Applied custom theme: ${selectedTheme.name}`);
    });
  }

  private async applyBuiltInTheme(index: number): Promise<void> {
    const selectedTheme = THEMES[index];

    if (!selectedTheme) {
      throw new Error(`Built-in theme at index ${index} not found`);
    }

    const response = await fetch(chrome.runtime.getURL(`css/themes/${selectedTheme.path}`));
    const css = await response.text();

    const themeContent = `/* ${selectedTheme.name}, a theme for BetterLyrics by ${selectedTheme.author} ${selectedTheme.link && `(${selectedTheme.link})`} */\n\n${css}\n`;

    await editorStateManager.queueOperation("theme", async () => {
      console.log(`[ThemeManager] Setting built-in theme: ${selectedTheme.name}`);

      await editorStateManager.setEditorContent(themeContent, `builtin-theme:${selectedTheme.name}`);

      await chrome.storage.sync.set({ themeName: selectedTheme.name });
      editorStateManager.setCurrentThemeName(selectedTheme.name);
      editorStateManager.setIsCustomTheme(false);

      showThemeName(selectedTheme.name, false);
      updateThemeSelectorButton();

      await this.saveTheme(themeContent);

      showAlert(`Applied theme: ${selectedTheme.name}`);
    });
  }

  private async saveTheme(css: string): Promise<void> {
    editorStateManager.incrementSaveCount();
    editorStateManager.setIsSaving(true);

    try {
      const result = await saveToStorageWithFallback(css, true);

      if (!result.success || !result.strategy) {
        throw new Error(`Failed to save theme: ${result.error?.message || "Unknown error"}`);
      }

      showSyncSuccess(result.strategy, result.wasRetry);
      await sendUpdateMessage(css, result.strategy);
    } finally {
      editorStateManager.setIsSaving(false);
      editorStateManager.resetSaveCount();
    }
  }
}

export const themeManager = new ThemeManager();

export async function applyStoreThemeToEditor(themeId: string, css: string, title: string): Promise<void> {
  console.log(`[BetterLyrics] applyStoreThemeToEditor called: ${title}, CSS length: ${css.length}`);
  const themeContent = css.startsWith("/*") ? css : `/* ${title}, a store theme */\n\n${css}\n`;

  try {
    await editorStateManager.queueOperation("theme", async () => {
      console.log(`[ThemeManager] Setting store theme: ${title}, content length: ${themeContent.length}`);

      await editorStateManager.setEditorContent(themeContent, `store-theme:${themeId}`);

      editorStateManager.setCurrentThemeName(title);
      editorStateManager.setIsCustomTheme(false);

      showThemeName(title, false);
      updateThemeSelectorButton();

      editorStateManager.incrementSaveCount();
      editorStateManager.setIsSaving(true);

      try {
        const result = await saveToStorageWithFallback(themeContent, true);

        if (!result.success || !result.strategy) {
          throw new Error(`Failed to save theme: ${result.error?.message || "Unknown error"}`);
        }

        showSyncSuccess(result.strategy, result.wasRetry);
        await sendUpdateMessage(themeContent, result.strategy);
      } finally {
        editorStateManager.setIsSaving(false);
        editorStateManager.resetSaveCount();
      }
    });
  } catch (error) {
    console.error(`[ThemeManager] Failed to apply store theme:`, error);
    showAlert("Error applying store theme! Please try again.");
  }
}

let storeThemeListenerInitialized = false;

export function initStoreThemeListener(): void {
  if (storeThemeListenerInitialized) return;
  storeThemeListenerInitialized = true;

  console.log("[BetterLyrics] initStoreThemeListener registered");

  document.addEventListener("store-theme-applied", async (event: Event) => {
    console.log("[BetterLyrics] store-theme-applied event received");
    const customEvent = event as CustomEvent<{ themeId: string; css: string; title: string }>;
    const { themeId, css, title } = customEvent.detail;
    console.log(`[BetterLyrics] Event detail: themeId=${themeId}, title=${title}, CSS length=${css.length}`);
    await applyStoreThemeToEditor(themeId, css, title);
  });
}

export function showThemeName(themeName: string, custom: boolean = false): void {
  if (themeNameDisplay && themeNameText) {
    themeNameText.textContent = themeName;
    themeNameDisplay.classList.add("active");
    editorStateManager.setIsCustomTheme(custom);

    if (editThemeBtn) {
      if (custom) {
        editThemeBtn.classList.add("active");
      } else {
        editThemeBtn.classList.remove("active");
      }
    }

    if (deleteThemeBtn) {
      if (custom) {
        deleteThemeBtn.classList.add("active");
      } else {
        deleteThemeBtn.classList.remove("active");
      }
    }
  }
}

export function hideThemeName(): void {
  if (themeNameDisplay) {
    themeNameDisplay.classList.remove("active");
  }
  if (editThemeBtn) {
    editThemeBtn.classList.remove("active");
  }
  if (deleteThemeBtn) {
    deleteThemeBtn.classList.remove("active");
  }
  editorStateManager.setIsCustomTheme(false);
}

export function onChange(_state: string) {
  console.log("[BetterLyrics] onChange triggered, isProgrammaticChange:", editorStateManager.getIsProgrammaticChange());
  if (editorStateManager.getIsProgrammaticChange()) {
    return;
  }

  editorStateManager.setIsUserTyping(true);

  const themeName = editorStateManager.getCurrentThemeName();
  const isCustom = editorStateManager.getIsCustomTheme();

  if (themeName !== null && !isCustom) {
    editorStateManager.setCurrentThemeName(null);
    chrome.storage.sync.remove("themeName");
    hideThemeName();
    updateThemeSelectorButton();
  } else if (isCustom && themeName) {
    debounceSaveCustomTheme();
  }
  console.log("[BetterLyrics] onChange calling debounceSave");
  debounceSave();
}

function debounceSaveCustomTheme() {
  editorStateManager.clearSaveCustomThemeTimeout();
  editorStateManager.setSaveCustomThemeTimeout(
    window.setTimeout(async () => {
      const themeName = editorStateManager.getCurrentThemeName();
      const isCustom = editorStateManager.getIsCustomTheme();

      if (themeName && isCustom) {
        const currentEditor = editorStateManager.getEditor();
        if (!currentEditor) return;

        const css = currentEditor.state.doc.toString();
        const cleanCss = css.replace(/^\/\*.*?\*\/\n\n/s, "").trim();

        try {
          await saveCustomTheme(themeName, cleanCss);
          console.log(`Auto-saved custom theme: ${themeName}`);
        } catch (error) {
          console.error("Error auto-saving custom theme:", error);
        }
      }
    }, SAVE_CUSTOM_THEME_DEBOUNCE)
  );
}

function debounceSave() {
  syncIndicator.style.display = "block";
  editorStateManager.clearSaveTimeout();
  editorStateManager.setSaveTimeout(window.setTimeout(saveToStorage, SAVE_DEBOUNCE_DELAY));
}

export function saveToStorage(isTheme = false) {
  console.log("[BetterLyrics] saveToStorage called, isTheme:", isTheme);
  const currentEditor = editorStateManager.getEditor();
  if (!currentEditor) {
    console.error("[BetterLyrics] Cannot save: editor not initialized");
    return;
  }

  editorStateManager.incrementSaveCount();
  editorStateManager.setIsSaving(true);
  const css = currentEditor.state.doc.toString();
  console.log("[BetterLyrics] saveToStorage CSS length:", css.length);

  const isCustom = editorStateManager.getIsCustomTheme();
  if (!isTheme && editorStateManager.getIsUserTyping() && !isCustom) {
    chrome.storage.sync.remove("themeName");
    editorStateManager.setCurrentThemeName(null);
  }

  saveToStorageWithFallback(css, isTheme)
    .then(result => {
      console.log("[BetterLyrics] saveToStorageWithFallback result:", result);
      if (result.success && result.strategy) {
        showSyncSuccess(result.strategy, result.wasRetry);
        sendUpdateMessage(css, result.strategy);
      } else {
        throw result.error;
      }
    })
    .catch(err => {
      console.error("Error saving to storage:", err);
      showSyncError(err);
    })
    .finally(() => {
      editorStateManager.setIsSaving(false);
      editorStateManager.setIsUserTyping(false);
      editorStateManager.resetSaveCount();
    });
}

export function updateThemeSelectorButton() {
  if (themeSelectorBtn) {
    const themeName = editorStateManager.getCurrentThemeName();
    if (themeName) {
      themeSelectorBtn.textContent = themeName;
    } else {
      themeSelectorBtn.textContent = "Choose a theme";
    }
  }
}

export async function populateThemeModal(): Promise<void> {
  if (!themeModalGrid) return;

  themeModalGrid.replaceChildren();

  const customThemes = await getCustomThemes();

  const builtInSection = document.createElement("div");
  builtInSection.className = "theme-modal-section";
  const builtInTitle = document.createElement("h3");
  builtInTitle.className = "theme-modal-section-title";
  builtInTitle.textContent = "Built-in Themes";
  builtInSection.appendChild(builtInTitle);

  const builtInGrid = document.createElement("div");
  builtInGrid.className = "theme-modal-items";

  THEMES.forEach((theme, index) => {
    const card = createThemeCard({
      name: theme.name,
      author: theme.author,
      isCustom: false,
      index,
    });
    builtInGrid.appendChild(card);
  });

  builtInSection.appendChild(builtInGrid);
  themeModalGrid.appendChild(builtInSection);

  if (customThemes.length > 0) {
    const customSection = document.createElement("div");
    customSection.className = "theme-modal-section";
    const customTitle = document.createElement("h3");
    customTitle.className = "theme-modal-section-title";
    customTitle.textContent = "Custom Themes";
    customSection.appendChild(customTitle);

    const customGrid = document.createElement("div");
    customGrid.className = "theme-modal-items";

    customThemes.forEach((theme, index) => {
      const card = createThemeCard({
        name: theme.name,
        author: "You",
        isCustom: true,
        index,
      });
      customGrid.appendChild(card);
    });

    customSection.appendChild(customGrid);
    themeModalGrid.appendChild(customSection);
  }
}

function createThemeCard(options: ThemeCardOptions): HTMLElement {
  const card = document.createElement("div");
  card.className = "theme-card";

  const isStoreThemeActive = editorStateManager.getIsStoreTheme();
  if (!isStoreThemeActive && editorStateManager.getCurrentThemeName() === options.name) {
    card.classList.add("selected");
  }

  const info = document.createElement("div");
  info.className = "theme-card-info";

  const name = document.createElement("div");
  name.className = "theme-card-name";
  name.textContent = options.name;
  name.title = options.name;

  const author = document.createElement("div");
  author.className = "theme-card-author";
  author.textContent = `by ${options.author}`;
  author.title = `by ${options.author}`;

  info.appendChild(name);
  info.appendChild(author);
  card.appendChild(info);

  card.addEventListener("click", () => {
    selectTheme(options.isCustom, options.index, options.name);
    closeThemeModal();
  });

  return card;
}

async function selectTheme(isCustom: boolean, index: number, themeName: string) {
  try {
    await themeManager.applyTheme(isCustom, index, themeName);
  } catch (error) {
    console.error("[BetterLyrics] Error selecting theme:", error);
  }
}

export function openThemeModal() {
  if (themeModalOverlay) {
    populateThemeModal();
    themeModalOverlay.style.display = "flex";
    requestAnimationFrame(() => {
      if (themeModalOverlay) {
        themeModalOverlay.classList.add("active");
      }
    });
  }
}

export function closeThemeModal() {
  if (themeModalOverlay) {
    const modal = themeModalOverlay.querySelector(".theme-modal");
    if (modal) {
      modal.classList.add("closing");
    }
    themeModalOverlay.classList.remove("active");

    setTimeout(() => {
      if (themeModalOverlay) {
        themeModalOverlay.style.display = "none";
        if (modal) {
          modal.classList.remove("closing");
        }
      }
    }, 200);
  }
}

export async function setThemeName() {
  await chrome.storage.sync.get("themeName").then(async syncData => {
    if (syncData.themeName) {
      if (syncData.themeName.startsWith(STORE_THEME_PREFIX)) {
        const storeThemeId = syncData.themeName.slice(STORE_THEME_PREFIX.length);
        const storeTheme = await getInstalledTheme(storeThemeId);
        if (storeTheme) {
          editorStateManager.setCurrentThemeName(storeTheme.title);
          editorStateManager.setIsCustomTheme(false);
          editorStateManager.setIsStoreTheme(true);
          showThemeName(storeTheme.title, false);
        } else {
          editorStateManager.setCurrentThemeName(null);
          editorStateManager.setIsCustomTheme(false);
          editorStateManager.setIsStoreTheme(false);
          hideThemeName();
        }
      } else {
        editorStateManager.setIsStoreTheme(false);
        const builtInIndex = THEMES.findIndex(theme => theme.name === syncData.themeName);
        if (builtInIndex !== -1) {
          editorStateManager.setCurrentThemeName(syncData.themeName);
          editorStateManager.setIsCustomTheme(false);
          showThemeName(syncData.themeName, false);
        } else {
          const customThemes = await getCustomThemes();
          const customIndex = customThemes.findIndex(theme => theme.name === syncData.themeName);
          if (customIndex !== -1) {
            editorStateManager.setCurrentThemeName(syncData.themeName);
            editorStateManager.setIsCustomTheme(true);
            showThemeName(syncData.themeName, true);
          } else {
            editorStateManager.setCurrentThemeName(null);
            editorStateManager.setIsCustomTheme(false);
            editorStateManager.setIsStoreTheme(false);
            hideThemeName();
          }
        }
      }
    } else {
      editorStateManager.setCurrentThemeName(null);
      editorStateManager.setIsCustomTheme(false);
      editorStateManager.setIsStoreTheme(false);
      hideThemeName();
    }
    updateThemeSelectorButton();
  });
}

export async function handleSaveTheme() {
  const currentEditor = editorStateManager.getEditor();
  if (!currentEditor) {
    showAlert("Editor not initialized!");
    return;
  }

  const css = currentEditor.state.doc.toString();
  if (!css || css.trim() === "") {
    showAlert("No CSS to save as theme!");
    return;
  }

  const themeName = await showPrompt("Save as Theme", "Enter a name for this theme:", "", "Theme name");
  if (!themeName || themeName.trim() === "") {
    return;
  }

  const cleanCss = css.replace(/^\/\*.*?\*\/\n\n/s, "").trim();

  try {
    await saveCustomTheme(themeName.trim(), cleanCss);

    chrome.storage.sync.set({ themeName: themeName.trim() });
    editorStateManager.setCurrentThemeName(themeName.trim());
    editorStateManager.setIsCustomTheme(true);

    showThemeName(themeName.trim(), true);
    updateThemeSelectorButton();
    showAlert(`Saved custom theme: ${themeName.trim()}`);
  } catch (error) {
    console.error("Error saving theme:", error);
    showAlert("Failed to save theme!");
  }
}

export async function handleRenameTheme() {
  const themeName = editorStateManager.getCurrentThemeName();
  const isCustom = editorStateManager.getIsCustomTheme();

  if (!themeName || !isCustom) return;

  const newName = await showPrompt("Rename Theme", "Enter a new name for this theme:", themeName, "Theme name");
  if (!newName || newName.trim() === "" || newName.trim() === themeName) {
    return;
  }

  try {
    await renameCustomTheme(themeName, newName.trim());

    editorStateManager.setCurrentThemeName(newName.trim());
    chrome.storage.sync.set({ themeName: newName.trim() });

    showThemeName(newName.trim(), true);
    updateThemeSelectorButton();
    showAlert(`Theme renamed to: ${newName.trim()}`);
  } catch (error: any) {
    console.error("Error renaming theme:", error);
    const errorMsg = error.message || "Failed to rename theme!";
    showAlert(errorMsg);
  }
}

export async function handleDeleteTheme() {
  const themeName = editorStateManager.getCurrentThemeName();
  const isCustom = editorStateManager.getIsCustomTheme();

  if (!themeName || !isCustom) return;

  const confirmed = await showConfirm(
    "Delete Theme",
    `Are you sure you want to delete the theme <code>${themeName}</code>?`,
    true
  );
  if (!confirmed) return;

  try {
    await deleteCustomTheme(themeName);

    chrome.storage.sync.remove("themeName");
    editorStateManager.setCurrentThemeName(null);
    editorStateManager.setIsCustomTheme(false);

    hideThemeName();
    updateThemeSelectorButton();
    showAlert("Custom theme deleted!");
  } catch (error) {
    console.error("Error deleting theme:", error);
    showAlert("Failed to delete theme!");
  }
}
