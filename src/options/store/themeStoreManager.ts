import type { InstalledStoreTheme, StoreTheme } from "./types";
import { fetchThemeCSS, fetchThemeShaderConfig } from "./themeStoreService";

const STORAGE_KEY = "installedStoreThemes";
const ACTIVE_STORE_THEME_KEY = "activeStoreTheme";

export async function getInstalledStoreThemes(): Promise<InstalledStoreTheme[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

export async function isThemeInstalled(themeId: string): Promise<boolean> {
  const installed = await getInstalledStoreThemes();
  return installed.some(t => t.id === themeId);
}

export async function getInstalledTheme(themeId: string): Promise<InstalledStoreTheme | null> {
  const installed = await getInstalledStoreThemes();
  return installed.find(t => t.id === themeId) || null;
}

export async function installTheme(theme: StoreTheme): Promise<InstalledStoreTheme> {
  const css = await fetchThemeCSS(theme.repo);
  const shaderConfig = theme.hasShaders ? await fetchThemeShaderConfig(theme.repo) : null;

  const installedTheme: InstalledStoreTheme = {
    id: theme.id,
    repo: theme.repo,
    title: theme.title,
    creators: theme.creators,
    css,
    shaderConfig: shaderConfig || undefined,
    installedAt: Date.now(),
    version: theme.version,
  };

  const installed = await getInstalledStoreThemes();
  const existingIndex = installed.findIndex(t => t.id === theme.id);

  if (existingIndex !== -1) {
    installed[existingIndex] = installedTheme;
  } else {
    installed.push(installedTheme);
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: installed });

  return installedTheme;
}

export async function removeTheme(themeId: string): Promise<void> {
  const installed = await getInstalledStoreThemes();
  const filtered = installed.filter(t => t.id !== themeId);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });

  const activeTheme = await getActiveStoreTheme();
  if (activeTheme === themeId) {
    await clearActiveStoreTheme();
  }
}

export async function getActiveStoreTheme(): Promise<string | null> {
  const result = await chrome.storage.sync.get(ACTIVE_STORE_THEME_KEY);
  return result[ACTIVE_STORE_THEME_KEY] || null;
}

export async function setActiveStoreTheme(themeId: string): Promise<void> {
  await chrome.storage.sync.set({ [ACTIVE_STORE_THEME_KEY]: themeId });
}

export async function clearActiveStoreTheme(): Promise<void> {
  await chrome.storage.sync.remove(ACTIVE_STORE_THEME_KEY);
}

export async function applyStoreTheme(themeId: string): Promise<string> {
  const theme = await getInstalledTheme(themeId);

  if (!theme) {
    throw new Error(`Theme "${themeId}" is not installed`);
  }

  await setActiveStoreTheme(themeId);

  return theme.css;
}

export function parseVersion(version: string): number[] {
  const cleanVersion = version.replace(/-.*$/, "");
  return cleanVersion.split(".").map(part => parseInt(part, 10) || 0);
}

export function compareVersions(current: string, required: string): boolean {
  const currentParts = parseVersion(current);
  const requiredParts = parseVersion(required);

  const maxLength = Math.max(currentParts.length, requiredParts.length);

  for (let i = 0; i < maxLength; i++) {
    const currentPart = currentParts[i] || 0;
    const requiredPart = requiredParts[i] || 0;

    if (currentPart > requiredPart) return true;
    if (currentPart < requiredPart) return false;
  }

  return true;
}

export function isVersionCompatible(themeMinVersion: string, extensionVersion: string): boolean {
  return compareVersions(extensionVersion, themeMinVersion);
}

export async function checkForThemeUpdates(
  installed: InstalledStoreTheme[],
  storeThemes: StoreTheme[]
): Promise<Map<string, StoreTheme>> {
  const updates = new Map<string, StoreTheme>();

  for (const installedTheme of installed) {
    const storeTheme = storeThemes.find(t => t.id === installedTheme.id);
    if (storeTheme && storeTheme.version !== installedTheme.version) {
      updates.set(installedTheme.id, storeTheme);
    }
  }

  return updates;
}

export async function updateTheme(theme: StoreTheme): Promise<InstalledStoreTheme> {
  return installTheme(theme);
}

export async function performSilentUpdates(storeThemes: StoreTheme[]): Promise<string[]> {
  const installed = await getInstalledStoreThemes();
  const updates = await checkForThemeUpdates(installed, storeThemes);
  const updatedIds: string[] = [];

  if (updates.size === 0) return updatedIds;

  const activeThemeId = await getActiveStoreTheme();

  for (const [themeId, storeTheme] of updates) {
    try {
      await updateTheme(storeTheme);
      updatedIds.push(themeId);
      console.log(`[ThemeStore] Auto-updated theme: ${storeTheme.title} to v${storeTheme.version}`);

      if (activeThemeId === themeId) {
        await applyStoreTheme(themeId);
        console.log(`[ThemeStore] Re-applied active theme after update: ${storeTheme.title}`);
      }
    } catch (err) {
      console.warn(`[ThemeStore] Failed to auto-update theme ${themeId}:`, err);
    }
  }

  return updatedIds;
}
