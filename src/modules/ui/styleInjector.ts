import { DEFAULT_LINE_SYNCED_WORD_DELAY_MS, GENERAL_ERROR_LOG, LOG_PREFIX } from "@constants";
import { decompressString, isCompressed } from "@core/compression";
import { compileRicsToStyles, loadChunkedStyles } from "@core/storage";
import { log } from "@utils";
import { AppState, reloadLyrics } from "@/index";
import { cachedDurations, cachedProperties } from "./animationEngine";

function parseBlyricsConfig(cssContent: string): Map<string, string> {
  const configMap = new Map<string, string>();

  const commentRegex = /\/\*([\s\S]*?)\*\//g;
  const configRegex = /(blyrics-[\w-]+)\s*=\s*([^;]+);/g;

  let commentMatch;

  while ((commentMatch = commentRegex.exec(cssContent)) !== null) {
    const commentContent = commentMatch[1];
    let configMatch;

    while ((configMatch = configRegex.exec(commentContent)) !== null) {
      const key = configMatch[1];
      let value = configMatch[2].trim();
      configMap.set(key, value);
    }
  }

  return configMap;
}

export function applyCustomStyles(css: string): void {
  let config = parseBlyricsConfig(css);

  let needsLyricReload = false;

  let disableRichSync = config.get("blyrics-disable-richsync") === "true";
  if (disableRichSync !== AppState.animationSettings.disableRichSynchronization) {
    needsLyricReload = true;
    AppState.animationSettings.disableRichSynchronization = disableRichSync;
  }

  let lineSyncedAnimationDelayMs = Number(
    config.get("blyrics-line-synced-animation-delay") || DEFAULT_LINE_SYNCED_WORD_DELAY_MS
  );
  if (lineSyncedAnimationDelayMs !== AppState.animationSettings.lineSyncedWordDelayMs) {
    needsLyricReload = true;
    AppState.animationSettings.lineSyncedWordDelayMs = lineSyncedAnimationDelayMs;
  }

  if (needsLyricReload) {
    reloadLyrics();
  }

  let styleTag = document.getElementById("blyrics-custom-style");
  if (styleTag) {
    styleTag.textContent = css;
  } else {
    styleTag = document.createElement("style");
    styleTag.id = "blyrics-custom-style";
    styleTag.textContent = css;
    document.head.appendChild(styleTag);
  }
  cachedDurations.clear();
  cachedProperties.clear();
}

function decompressStyles(css: string): string {
  return decompressString(css);
}

export async function getAndApplyCustomStyles(): Promise<void> {
  try {
    const syncData = await chrome.storage.sync.get(["cssStorageType", "customCSS", "cssCompressed"]);

    let css: string | null = null;
    let compressed = false;

    if (syncData.cssStorageType === "chunked") {
      css = await loadChunkedStyles();
      compressed = syncData.cssCompressed || false;
    } else if (syncData.cssStorageType === "local") {
      const localData = await chrome.storage.local.get(["customCSS", "cssCompressed"]);
      css = localData.customCSS;
      compressed = localData.cssCompressed || false;
    } else {
      css = syncData.customCSS;
      compressed = syncData.cssCompressed || false;
    }

    if (css) {
      if (compressed || isCompressed(css)) {
        css = decompressStyles(css);
      }
      applyCustomStyles(compileRicsToStyles(css));
    }
  } catch (error) {
    log(GENERAL_ERROR_LOG, error);
    try {
      const chunkedStyles = await loadChunkedStyles();
      if (chunkedStyles) {
        const syncData = await chrome.storage.sync.get("cssCompressed");
        let css = chunkedStyles;
        if (syncData.cssCompressed || isCompressed(css)) {
          css = decompressStyles(css);
        }
        applyCustomStyles(compileRicsToStyles(css));
        return;
      }

      const localData = await chrome.storage.local.get(["customCSS", "cssCompressed"]);
      if (localData.customCSS) {
        let css = localData.customCSS;
        if (localData.cssCompressed || isCompressed(css)) {
          css = decompressStyles(css);
        }
        applyCustomStyles(compileRicsToStyles(css));
        return;
      }

      const syncData = await chrome.storage.sync.get(["customCSS", "cssCompressed"]);
      if (syncData.customCSS) {
        let css = syncData.customCSS;
        if (syncData.cssCompressed || isCompressed(css)) {
          css = decompressStyles(css);
        }
        applyCustomStyles(compileRicsToStyles(css));
      }
    } catch (fallbackError) {
      log(GENERAL_ERROR_LOG, fallbackError);
    }
  }
}

async function handleStoreThemeChange(key: string, change: { oldValue?: any; newValue?: any }): Promise<void> {
  const themeId = key.replace("storeTheme:", "");
  const { activeStoreTheme } = await chrome.storage.sync.get("activeStoreTheme");

  if (activeStoreTheme !== themeId) return;

  const theme = change.newValue;
  if (!theme?.css) return;

  if (change.oldValue?.css === theme.css && change.oldValue?.version === theme.version) return;

  log(LOG_PREFIX, "Store theme updated:", theme.title || themeId);
  applyCustomStyles(compileRicsToStyles(theme.css));
}

export function subscribeToCustomStyles(): void {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if ((area === "sync" || area === "local") && changes.customCSS) {
      if (changes.customCSS.newValue) {
        let css = changes.customCSS.newValue;
        if (isCompressed(css)) {
          css = decompressStyles(css);
        }
        applyCustomStyles(compileRicsToStyles(css));
      }
    }

    if (area === "local") {
      for (const key of Object.keys(changes)) {
        if (key.startsWith("storeTheme:")) {
          await handleStoreThemeChange(key, changes[key]);
        }
      }
    }
  });
  getAndApplyCustomStyles();
}
