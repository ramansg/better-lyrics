import { fetchFullTheme, fetchThemeCSS, fetchThemeMetadata, fetchThemeShaderConfig } from "./themeStoreService";
import type { InstalledStoreTheme, StoreTheme, ThemeSource } from "./types";

export interface InstallOptions {
  source?: ThemeSource;
  sourceUrl?: string;
  branch?: string;
}

const THEME_INDEX_KEY = "storeThemeIndex";
const THEME_PREFIX = "storeTheme:";
const ACTIVE_STORE_THEME_KEY = "activeStoreTheme";

const LEGACY_STORAGE_KEY = "installedStoreThemes";

interface ThemeIndex {
  themeIds: string[];
}

async function getThemeIndex(): Promise<ThemeIndex> {
  const result = await chrome.storage.local.get(THEME_INDEX_KEY);
  return result[THEME_INDEX_KEY] || { themeIds: [] };
}

async function setThemeIndex(index: ThemeIndex): Promise<void> {
  await chrome.storage.local.set({ [THEME_INDEX_KEY]: index });
}

function getThemeStorageKey(themeId: string): string {
  return `${THEME_PREFIX}${themeId}`;
}

async function migrateFromLegacyStorage(): Promise<void> {
  const result = await chrome.storage.local.get(LEGACY_STORAGE_KEY);
  const legacyThemes: InstalledStoreTheme[] = result[LEGACY_STORAGE_KEY];

  if (!legacyThemes || legacyThemes.length === 0) return;

  console.log(`[ThemeStoreManager] Migrating ${legacyThemes.length} themes from legacy storage`);

  const themeIds: string[] = [];

  for (const theme of legacyThemes) {
    try {
      await chrome.storage.local.set({ [getThemeStorageKey(theme.id)]: theme });
      themeIds.push(theme.id);
    } catch (err) {
      console.warn(`[ThemeStoreManager] Failed to migrate theme ${theme.id}:`, err);
    }
  }

  await setThemeIndex({ themeIds });
  await chrome.storage.local.remove(LEGACY_STORAGE_KEY);

  console.log(`[ThemeStoreManager] Migration complete: ${themeIds.length} themes migrated`);
}

let migrationPromise: Promise<void> | null = null;

async function ensureMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateFromLegacyStorage();
  }
  await migrationPromise;
}

export async function getInstalledStoreThemes(): Promise<InstalledStoreTheme[]> {
  await ensureMigrated();

  const index = await getThemeIndex();
  if (index.themeIds.length === 0) return [];

  const keys = index.themeIds.map(getThemeStorageKey);
  const result = await chrome.storage.local.get(keys);

  const themes: InstalledStoreTheme[] = [];
  const validIds: string[] = [];

  for (const id of index.themeIds) {
    const theme = result[getThemeStorageKey(id)];
    if (theme) {
      themes.push(theme);
      validIds.push(id);
    }
  }

  if (validIds.length !== index.themeIds.length) {
    await setThemeIndex({ themeIds: validIds });
  }

  return themes;
}

export async function isThemeInstalled(themeId: string): Promise<boolean> {
  await ensureMigrated();
  const index = await getThemeIndex();
  return index.themeIds.includes(themeId);
}

export async function getInstalledTheme(themeId: string): Promise<InstalledStoreTheme | null> {
  await ensureMigrated();
  const result = await chrome.storage.local.get(getThemeStorageKey(themeId));
  return result[getThemeStorageKey(themeId)] || null;
}

export async function installTheme(theme: StoreTheme, options: InstallOptions = {}): Promise<InstalledStoreTheme> {
  await ensureMigrated();

  const branch = options.branch;
  const { css } = await fetchThemeCSS(theme.repo, branch);
  const shaderConfig = theme.hasShaders ? await fetchThemeShaderConfig(theme.repo, branch) : null;

  const installedTheme: InstalledStoreTheme = {
    id: theme.id,
    repo: theme.repo,
    title: theme.title,
    creators: theme.creators,
    css,
    shaderConfig: shaderConfig || undefined,
    installedAt: Date.now(),
    version: theme.version,
    source: options.source,
    sourceUrl: options.sourceUrl,
    branch: options.branch,
    description: theme.description,
    coverUrl: theme.coverUrl,
    imageUrls: theme.imageUrls,
    minVersion: theme.minVersion,
    hasShaders: theme.hasShaders,
    tags: theme.tags,
  };

  try {
    await chrome.storage.local.set({ [getThemeStorageKey(theme.id)]: installedTheme });
  } catch (err) {
    if (err instanceof Error && err.message.includes("QUOTA")) {
      throw new Error(`Cannot install theme: storage is full. Please remove some installed themes and try again.`);
    }
    throw err;
  }

  const index = await getThemeIndex();
  if (!index.themeIds.includes(theme.id)) {
    index.themeIds.push(theme.id);
    await setThemeIndex(index);
  }

  return installedTheme;
}

export async function removeTheme(themeId: string): Promise<void> {
  await ensureMigrated();

  await chrome.storage.local.remove(getThemeStorageKey(themeId));

  const index = await getThemeIndex();
  index.themeIds = index.themeIds.filter(id => id !== themeId);
  await setThemeIndex(index);

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
  return cleanVersion.split(".").map(part => {
    const num = parseInt(part, 10);
    if (isNaN(num)) {
      console.warn(`[ThemeStoreManager] Non-numeric version part "${part}" in "${version}", treating as 0`);
      return 0;
    }
    return num;
  });
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

export async function performUrlThemeUpdates(): Promise<string[]> {
  const installed = await getInstalledStoreThemes();
  const urlThemes = installed.filter(t => t.source === "url");
  const updatedIds: string[] = [];

  if (urlThemes.length === 0) return updatedIds;

  const activeThemeId = await getActiveStoreTheme();

  for (const theme of urlThemes) {
    try {
      const metadata = await fetchThemeMetadata(theme.repo, theme.branch);
      if (metadata.version === theme.version) continue;

      const fullTheme = await fetchFullTheme(theme.repo, theme.branch);
      await installTheme(fullTheme, {
        source: "url",
        sourceUrl: theme.sourceUrl,
        branch: theme.branch,
      });

      updatedIds.push(theme.id);

      if (activeThemeId === theme.id) {
        await applyStoreTheme(theme.id);
      }
    } catch (err) {
      console.warn(`[ThemeStore] Failed to check/update URL theme ${theme.id}:`, err);
    }
  }

  return updatedIds;
}

export async function refreshUrlThemesMetadata(): Promise<number> {
  const installed = await getInstalledStoreThemes();
  const urlThemesNeedingRefresh = installed.filter(t => t.source === "url" && !t.coverUrl);
  let refreshedCount = 0;

  for (const theme of urlThemesNeedingRefresh) {
    try {
      const fullTheme = await fetchFullTheme(theme.repo, theme.branch);
      await installTheme(fullTheme, {
        source: "url",
        sourceUrl: theme.sourceUrl,
        branch: theme.branch,
      });
      refreshedCount++;
    } catch (err) {
      console.warn(`[ThemeStore] Failed to refresh URL theme ${theme.id}:`, err);
    }
  }

  return refreshedCount;
}
