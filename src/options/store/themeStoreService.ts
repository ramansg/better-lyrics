import type {
  ThemeStoreIndex,
  StoreTheme,
  StoreThemeMetadata,
  ThemeValidationResult,
  PermissionStatus,
} from "./types";

const INDEX_REPO = "better-lyrics/themes";
const BRANCH_CANDIDATES = ["main", "master"];

const REQUIRED_ORIGINS = ["https://raw.githubusercontent.com/*", "https://api.github.com/*"];

const repoBranchCache = new Map<string, string>();

function getRawGitHubUrl(repo: string, branch: string, path: string, bustCache = true): string {
  const base = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
  return bustCache ? `${base}?t=${Date.now()}` : base;
}

async function detectRepoBranch(repo: string, checkFile = "metadata.json"): Promise<string> {
  const cacheKey = `${repo}:${checkFile}`;
  const cached = repoBranchCache.get(cacheKey);
  if (cached) return cached;

  for (const branch of BRANCH_CANDIDATES) {
    const url = getRawGitHubUrl(repo, branch, checkFile);
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) {
        repoBranchCache.set(cacheKey, branch);
        return branch;
      }
    } catch {
      // Silently continue to next branch candidate
    }
  }

  repoBranchCache.set(cacheKey, BRANCH_CANDIDATES[0]);
  return BRANCH_CANDIDATES[0];
}

export async function checkGitHubPermissions(): Promise<PermissionStatus> {
  const granted = await chrome.permissions.contains({ origins: REQUIRED_ORIGINS });
  return { granted, canRequest: true };
}

export async function requestGitHubPermissions(): Promise<boolean> {
  return chrome.permissions.request({ origins: REQUIRED_ORIGINS });
}

export async function fetchThemeStoreIndex(): Promise<string[]> {
  const branch = await detectRepoBranch(INDEX_REPO, "index.json");
  const url = getRawGitHubUrl(INDEX_REPO, branch, "index.json");
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch theme index: ${response.status}`);
  }

  const data: ThemeStoreIndex = await response.json();
  return data.themes.map(t => t.repo);
}

export async function fetchThemeMetadata(repo: string): Promise<StoreThemeMetadata> {
  const branch = await detectRepoBranch(repo);
  const url = getRawGitHubUrl(repo, branch, "metadata.json");
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch metadata for ${repo}: ${response.status}`);
  }

  return response.json();
}

export async function fetchThemeCSS(repo: string): Promise<string> {
  const branch = await detectRepoBranch(repo);
  const url = getRawGitHubUrl(repo, branch, "style.css");
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch CSS for ${repo}: ${response.status}`);
  }

  return response.text();
}

export async function fetchThemeShaderConfig(repo: string): Promise<Record<string, unknown> | null> {
  const branch = await detectRepoBranch(repo);
  const url = getRawGitHubUrl(repo, branch, "shader.json");

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function checkFileExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchFullTheme(repo: string): Promise<StoreTheme> {
  const metadata = await fetchThemeMetadata(repo);
  const branch = await detectRepoBranch(repo);

  const baseUrl = getRawGitHubUrl(repo, branch, "", false);
  const cssUrl = `${baseUrl}style.css`;
  const shaderUrl = metadata.hasShaders ? `${baseUrl}shader.json` : undefined;

  const imageUrls: string[] = [];
  if (metadata.images && metadata.images.length > 0) {
    for (const img of metadata.images) {
      imageUrls.push(`${baseUrl}images/${img}`);
    }
  }

  let coverUrl = `${baseUrl}cover.png`;
  const hasCover = await checkFileExists(coverUrl);
  if (!hasCover && imageUrls.length > 0) {
    coverUrl = imageUrls[0];
  }

  const allImageUrls = [coverUrl, ...imageUrls.filter(url => url !== coverUrl)];

  return {
    ...metadata,
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

export async function validateThemeRepo(repo: string): Promise<ThemeValidationResult> {
  const errors: string[] = [];
  const missingFiles: string[] = [];
  const branch = await detectRepoBranch(repo);

  const requiredFiles = ["style.css", "metadata.json"];

  for (const file of requiredFiles) {
    const url = getRawGitHubUrl(repo, branch, file);
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (!response.ok) {
        missingFiles.push(file);
      }
    } catch {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    errors.push(`Missing required files: ${missingFiles.join(", ")}`);
    return { valid: false, errors, missingFiles };
  }

  try {
    const metadata = await fetchThemeMetadata(repo);

    if (!metadata.id) errors.push("metadata.json missing 'id' field");
    if (!metadata.title) errors.push("metadata.json missing 'title' field");
    if (!metadata.description) errors.push("metadata.json missing 'description' field");
    if (!metadata.creators || metadata.creators.length === 0) {
      errors.push("metadata.json missing 'creators' field");
    }
    if (!metadata.minVersion) errors.push("metadata.json missing 'minVersion' field");
    if (typeof metadata.hasShaders !== "boolean") {
      errors.push("metadata.json missing 'hasShaders' field");
    }
    if (!metadata.version) errors.push("metadata.json missing 'version' field");

    const coverUrl = getRawGitHubUrl(repo, branch, "cover.png");
    const hasCover = await checkFileExists(coverUrl);
    if (!hasCover && (!metadata.images || metadata.images.length === 0)) {
      errors.push("Theme must have either cover.png or images in metadata");
    }
  } catch (err) {
    errors.push(`Failed to parse metadata.json: ${err}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    missingFiles,
  };
}

export function parseGitHubRepoUrl(input: string): string | null {
  const trimmed = input.trim();

  const fullUrlMatch = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+\/[^/]+)\/?(?:\.git)?$/i);
  if (fullUrlMatch) {
    return fullUrlMatch[1].replace(/\.git$/, "");
  }

  const shortMatch = trimmed.match(/^([^/]+\/[^/]+)$/);
  if (shortMatch && !trimmed.includes(" ") && !trimmed.includes(":")) {
    return shortMatch[1];
  }

  return null;
}
