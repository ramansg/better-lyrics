import type { ThemeCardOptions } from "./types";

import { showAlert } from "./alerts";
import { SAVE_CUSTOM_THEME_DEBOUNCE, SAVE_DEBOUNCE_DELAY } from "./config";
import { createEditorState } from "./core";
import {
  deleteThemeBtn,
  editThemeBtn,
  syncIndicator,
  themeModalGrid,
  themeModalOverlay,
  themeSelectorBtn,
  themeNameDisplay,
  themeNameText,
} from "./dom";
import { showConfirm, showPrompt } from "./modals";
import {
  currentThemeName,
  editor,
  incrementSaveCount,
  isCustomTheme,
  isUserTyping,
  saveCustomThemeTimeout,
  saveTimeout,
  setCurrentThemeName,
  setIsCustomTheme,
  setIsUserTyping,
  setSaveCustomThemeTimeout,
  setSaveTimeout,
} from "./state";
import { saveToStorageWithFallback, sendUpdateMessage, showSyncError, showSyncSuccess } from "./storage";

import THEMES, { deleteCustomTheme, getCustomThemes, renameCustomTheme, saveCustomTheme } from "../themes";

export function showThemeName(themeName: string, custom: boolean = false): void {
  if (themeNameDisplay && themeNameText) {
    themeNameText.textContent = themeName;
    themeNameDisplay.classList.add("active");
    setIsCustomTheme(custom);

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
  setIsCustomTheme(false);
}

export function onChange(_state: string) {
  setIsUserTyping(true);
  if (currentThemeName !== null && !isCustomTheme) {
    setCurrentThemeName(null);
    chrome.storage.sync.remove("themeName");
    hideThemeName();
    updateThemeSelectorButton();
  } else if (isCustomTheme && currentThemeName) {
    debounceSaveCustomTheme();
  }
  debounceSave();
}

function debounceSaveCustomTheme() {
  clearTimeout(saveCustomThemeTimeout);
  setSaveCustomThemeTimeout(
    window.setTimeout(async () => {
      if (currentThemeName && isCustomTheme) {
        const css = editor.state.doc.toString();
        const cleanCss = css.replace(/^\/\*.*?\*\/\n\n/s, "").trim();

        try {
          await saveCustomTheme(currentThemeName, cleanCss);
          console.log(`Auto-saved custom theme: ${currentThemeName}`);
        } catch (error) {
          console.error("Error auto-saving custom theme:", error);
        }
      }
    }, SAVE_CUSTOM_THEME_DEBOUNCE)
  );
}

function debounceSave() {
  syncIndicator.style.display = "block";
  clearTimeout(saveTimeout);
  setSaveTimeout(window.setTimeout(saveToStorage, SAVE_DEBOUNCE_DELAY));
}

export function saveToStorage(isTheme = false) {
  incrementSaveCount();
  const css = editor.state.doc.toString();

  if (!isTheme && isUserTyping && !isCustomTheme) {
    chrome.storage.sync.remove("themeName");
    setCurrentThemeName(null);
  }

  saveToStorageWithFallback(css, isTheme)
    .then(result => {
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
    });

  setIsUserTyping(false);
}

export function updateThemeSelectorButton() {
  if (themeSelectorBtn) {
    if (currentThemeName) {
      themeSelectorBtn.textContent = currentThemeName;
    } else {
      themeSelectorBtn.textContent = "Choose a theme";
    }
  }
}

export async function populateThemeModal(): Promise<void> {
  if (!themeModalGrid) return;

  themeModalGrid.innerHTML = "";

  const customThemes = await getCustomThemes();

  const builtInSection = document.createElement("div");
  builtInSection.className = "theme-modal-section";
  builtInSection.innerHTML = '<h3 class="theme-modal-section-title">Built-in Themes</h3>';

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
    customSection.innerHTML = '<h3 class="theme-modal-section-title">Custom Themes</h3>';

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

  if (currentThemeName === options.name) {
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

async function selectTheme(isCustom: boolean, index: number, _themeName: string) {
  if (isCustom) {
    const customThemes = await getCustomThemes();
    const selectedTheme = customThemes[index];
    if (selectedTheme) {
      const themeContent = `/* ${selectedTheme.name}, a custom theme for BetterLyrics */\n\n${selectedTheme.css}\n`;
      editor.setState(createEditorState(themeContent));

      chrome.storage.sync.set({ themeName: selectedTheme.name });
      setCurrentThemeName(selectedTheme.name);
      setIsUserTyping(false);
      saveToStorage(true);
      showThemeName(selectedTheme.name, true);
      updateThemeSelectorButton();
      showAlert(`Applied custom theme: ${selectedTheme.name}`);
    }
  } else {
    const selectedTheme = THEMES[index];
    if (selectedTheme) {
      fetch(chrome.runtime.getURL(`css/themes/${selectedTheme.path}`))
        .then(response => response.text())
        .then(css => {
          const themeContent = `/* ${selectedTheme.name}, a theme for BetterLyrics by ${selectedTheme.author} ${selectedTheme.link && `(${selectedTheme.link})`} */\n\n${css}\n`;
          editor.setState(createEditorState(themeContent));

          chrome.storage.sync.set({ themeName: selectedTheme.name });
          setCurrentThemeName(selectedTheme.name);
          setIsUserTyping(false);
          saveToStorage(true);
          showThemeName(selectedTheme.name, false);
          updateThemeSelectorButton();
          showAlert(`Applied theme: ${selectedTheme.name}`);
        });
    }
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
      const builtInIndex = THEMES.findIndex(theme => theme.name === syncData.themeName);
      if (builtInIndex !== -1) {
        setCurrentThemeName(syncData.themeName);
        showThemeName(syncData.themeName, false);
      } else {
        const customThemes = await getCustomThemes();
        const customIndex = customThemes.findIndex(theme => theme.name === syncData.themeName);
        if (customIndex !== -1) {
          setCurrentThemeName(syncData.themeName);
          showThemeName(syncData.themeName, true);
        } else {
          hideThemeName();
        }
      }
    } else {
      hideThemeName();
    }
    updateThemeSelectorButton();
  });
}

export async function handleSaveTheme() {
  const css = editor.state.doc.toString();
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
    setCurrentThemeName(themeName.trim());

    showThemeName(themeName.trim(), true);
    updateThemeSelectorButton();
    showAlert(`Saved custom theme: ${themeName.trim()}`);
  } catch (error) {
    console.error("Error saving theme:", error);
    showAlert("Failed to save theme!");
  }
}

export async function handleRenameTheme() {
  if (!currentThemeName || !isCustomTheme) return;

  const newName = await showPrompt("Rename Theme", "Enter a new name for this theme:", currentThemeName, "Theme name");
  if (!newName || newName.trim() === "" || newName.trim() === currentThemeName) {
    return;
  }

  try {
    await renameCustomTheme(currentThemeName, newName.trim());

    setCurrentThemeName(newName.trim());
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
  if (!currentThemeName || !isCustomTheme) return;

  const confirmed = await showConfirm(
    "Delete Theme",
    `Are you sure you want to delete the theme <code>${currentThemeName}</code>?`,
    true
  );
  if (!confirmed) return;

  try {
    await deleteCustomTheme(currentThemeName);

    chrome.storage.sync.remove("themeName");
    setCurrentThemeName(null);

    hideThemeName();
    updateThemeSelectorButton();
    showAlert("Custom theme deleted!");
  } catch (error) {
    console.error("Error deleting theme:", error);
    showAlert("Failed to delete theme!");
  }
}
