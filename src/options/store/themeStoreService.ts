import type { PermissionStatus, StoreTheme, StoreThemeMetadata, ThemeStoreIndex, ThemeValidationResult } from "./types";

const INDEX_REPO = "better-lyrics/themes";
const DEFAULT_TIMEOUT_MS = 10000;

const REQUIRED_ORIGINS = [
  "https://raw.githubusercontent.com/*",
  "https://api.github.com/*",
  "https://better-lyrics-themes-api.boidu.dev/*",
];

interface BranchCacheEntry {
  branch: string;
  timestamp: number;
}

const BRANCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const repoBranchCache = new Map<string, BranchCacheEntry>();

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getRawGitHubUrl(repo: string, branch: string, path: string, bustCache = true): string {
  const base = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
  return bustCache ? `${base}?t=${Date.now()}` : base;
}

async function testBranchExists(repo: string, branch: string, testFile = "metadata.json"): Promise<boolean> {
  try {
    const url = `https://raw.githubusercontent.com/${repo}/${branch}/${testFile}`;
    const response = await fetchWithTimeout(url, { method: "HEAD" }, 5000);
    return response.ok;
  } catch {
    return false;
  }
}

async function getDefaultBranch(repo: string, testFile = "metadata.json"): Promise<string> {
  const cached = repoBranchCache.get(repo);
  if (cached && Date.now() - cached.timestamp < BRANCH_CACHE_TTL_MS) {
    return cached.branch;
  }

  try {
    const response = await fetchWithTimeout(
      `https://api.github.com/repos/${repo}`,
      { headers: { Accept: "application/vnd.github.v3+json" } },
      5000
    );

    if (response.ok) {
      const data = await response.json();
      const branch = data.default_branch || "main";
      repoBranchCache.set(repo, { branch, timestamp: Date.now() });
      return branch;
    }
  } catch {
    // API failed, fall through to branch testing
  }

  if (await testBranchExists(repo, "master", testFile)) {
    repoBranchCache.set(repo, { branch: "master", timestamp: Date.now() });
    return "master";
  }

  if (await testBranchExists(repo, "main", testFile)) {
    repoBranchCache.set(repo, { branch: "main", timestamp: Date.now() });
    return "main";
  }

  repoBranchCache.set(repo, { branch: "main", timestamp: Date.now() });
  return "main";
}

export async function checkStorePermissions(): Promise<PermissionStatus> {
  const granted = await chrome.permissions.contains({ origins: REQUIRED_ORIGINS });
  return { granted, canRequest: true };
}

export async function requestStorePermissions(): Promise<boolean> {
  return chrome.permissions.request({ origins: REQUIRED_ORIGINS });
}

export async function fetchThemeStoreIndex(): Promise<string[]> {
  const branch = await getDefaultBranch(INDEX_REPO, "index.json");
  const url = getRawGitHubUrl(INDEX_REPO, branch, "index.json");
  const response = await fetchWithTimeout(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch theme index: ${response.status}`);
  }

  const data: ThemeStoreIndex = await response.json();
  return data.themes.map(t => t.repo);
}

export async function fetchThemeMetadata(repo: string, branchOverride?: string): Promise<StoreThemeMetadata> {
  const branch = branchOverride ?? (await getDefaultBranch(repo));
  const url = getRawGitHubUrl(repo, branch, "metadata.json");
  const response = await fetchWithTimeout(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch metadata for ${repo}: ${response.status}`);
  }

  return response.json();
}

export async function fetchThemeCSS(repo: string, branchOverride?: string): Promise<{ css: string; isRics: boolean }> {
  const branch = branchOverride ?? (await getDefaultBranch(repo));

  const ricsUrl = getRawGitHubUrl(repo, branch, "style.rics");
  const ricsResponse = await fetchWithTimeout(ricsUrl, { cache: "no-store" }).catch(() => null);

  if (ricsResponse?.ok) {
    return { css: await ricsResponse.text(), isRics: true };
  }

  const cssUrl = getRawGitHubUrl(repo, branch, "style.css");
  const cssResponse = await fetchWithTimeout(cssUrl, { cache: "no-store" });

  if (!cssResponse.ok) {
    throw new Error(`Failed to fetch style file for ${repo}: no style.rics or style.css found`);
  }

  return { css: await cssResponse.text(), isRics: false };
}

async function checkFileExists(url: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(url, { method: "HEAD" }, 5000);
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchThemeShaderConfig(
  repo: string,
  branchOverride?: string
): Promise<Record<string, unknown> | null> {
  const branch = branchOverride ?? (await getDefaultBranch(repo));
  const url = getRawGitHubUrl(repo, branch, "shader.json");

  const exists = await checkFileExists(url);
  if (!exists) return null;

  try {
    const response = await fetchWithTimeout(url, { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function fetchThemeDescription(repo: string, branchOverride?: string): Promise<string | null> {
  const branch = branchOverride ?? (await getDefaultBranch(repo));
  const url = getRawGitHubUrl(repo, branch, "DESCRIPTION.md");

  try {
    const response = await fetchWithTimeout(url, { cache: "no-store" });
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

export async function fetchFullTheme(repo: string, branchOverride?: string): Promise<StoreTheme> {
  const branch = branchOverride ?? (await getDefaultBranch(repo));
  const [metadata, descriptionMd] = await Promise.all([
    fetchThemeMetadata(repo, branch),
    fetchThemeDescription(repo, branch),
  ]);

  const description = descriptionMd ?? metadata.description ?? "";

  const baseUrl = getRawGitHubUrl(repo, branch, "", false);

  const ricsUrl = `${baseUrl}style.rics`;
  const hasRics = await checkFileExists(ricsUrl);
  const cssUrl = hasRics ? ricsUrl : `${baseUrl}style.css`;

  const shaderUrl = metadata.hasShaders ? `${baseUrl}shader.json` : undefined;

  const imageUrls: string[] = [];
  if (metadata.images && metadata.images.length > 0) {
    for (const img of metadata.images) {
      imageUrls.push(`${baseUrl}images/${img}`);
    }
  }

  let coverUrl: string;
  let allImageUrls: string[];

  if (imageUrls.length > 0) {
    coverUrl = imageUrls[0];
    allImageUrls = imageUrls;
  } else {
    coverUrl = `${baseUrl}cover.png`;
    allImageUrls = [coverUrl];
  }

  return {
    ...metadata,
    description,
    repo,
    coverUrl,
    imageUrls: allImageUrls,
    cssUrl,
    shaderUrl,
  };
}

export async function fetchAllStoreThemes(): Promise<StoreTheme[]> {
  const repos = await fetchThemeStoreIndex();
  const themes: StoreTheme[] = [];

  const results = await Promise.allSettled(repos.map(repo => fetchFullTheme(repo)));

  for (const result of results) {
    if (result.status === "fulfilled") {
      themes.push(result.value);
    } else {
      console.warn("[ThemeStore] Failed to fetch theme:", result.reason);
    }
  }

  return themes;
}

export async function validateThemeRepo(repo: string, branchOverride?: string): Promise<ThemeValidationResult> {
  const errors: string[] = [];
  const missingFiles: string[] = [];
  const branch = branchOverride ?? (await getDefaultBranch(repo));

  const metadataUrl = getRawGitHubUrl(repo, branch, "metadata.json");
  try {
    const response = await fetchWithTimeout(metadataUrl, { method: "HEAD" }, 5000);
    if (!response.ok) {
      missingFiles.push("metadata.json");
      errors.push("Missing required file: metadata.json");
      return { valid: false, errors, missingFiles };
    }
  } catch {
    missingFiles.push("metadata.json");
    errors.push("Missing required file: metadata.json");
    return { valid: false, errors, missingFiles };
  }

  let metadata;
  try {
    metadata = await fetchThemeMetadata(repo, branch);
  } catch (err) {
    errors.push(`Failed to parse metadata.json: ${err}`);
    return { valid: false, errors, missingFiles };
  }

  const ricsUrl = getRawGitHubUrl(repo, branch, "style.rics");
  const cssUrl = getRawGitHubUrl(repo, branch, "style.css");
  const hasRics = await checkFileExists(ricsUrl);
  const hasCss = await checkFileExists(cssUrl);

  if (!hasRics && !hasCss) {
    missingFiles.push("style.rics or style.css");
    errors.push("Missing required file: style.rics or style.css");
    return { valid: false, errors, missingFiles };
  }

  const descriptionMd = await fetchThemeDescription(repo, branch);

  if (!metadata.id) errors.push("metadata.json missing 'id' field");
  if (!metadata.title) errors.push("metadata.json missing 'title' field");
  if (!metadata.description && !descriptionMd) {
    errors.push("Theme must have either 'description' in metadata.json or a DESCRIPTION.md file");
  }
  if (!metadata.creators || metadata.creators.length === 0) {
    errors.push("metadata.json missing 'creators' field");
  }
  if (!metadata.minVersion) errors.push("metadata.json missing 'minVersion' field");
  if (typeof metadata.hasShaders !== "boolean") {
    errors.push("metadata.json missing 'hasShaders' field");
  }
  if (!metadata.version) errors.push("metadata.json missing 'version' field");

  if (!metadata.images || metadata.images.length === 0) {
    const coverUrl = getRawGitHubUrl(repo, branch, "cover.png");
    const hasCover = await checkFileExists(coverUrl);
    if (!hasCover) {
      errors.push("Theme must have either cover.png or images in metadata");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    missingFiles,
  };
}

export interface ParsedGitHubUrl {
  repo: string;
  branch?: string;
}

export function parseGitHubRepoUrl(input: string): ParsedGitHubUrl | null {
  const trimmed = input.trim();

  // Match: github.com/user/repo/tree/branch-name (with optional nested paths like feature/foo)
  const branchUrlMatch = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+\/[^/]+)\/tree\/(.+?)\/?$/i);
  if (branchUrlMatch) {
    return {
      repo: branchUrlMatch[1],
      branch: branchUrlMatch[2],
    };
  }

  // Match: github.com/user/repo
  const fullUrlMatch = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+\/[^/]+)\/?(?:\.git)?$/i);
  if (fullUrlMatch) {
    return { repo: fullUrlMatch[1].replace(/\.git$/, "") };
  }

  // Match: user/repo
  const shortMatch = trimmed.match(/^([^/]+\/[^/]+)$/);
  if (shortMatch && !trimmed.includes(" ") && !trimmed.includes(":")) {
    return { repo: shortMatch[1] };
  }

  return null;
}
