import type { AllThemeStats, RatingResult, ApiResult } from "./types";

const API_BASE = "https://better-lyrics-themes-api.boidu.dev";
const DEFAULT_TIMEOUT_MS = 10000;

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

async function getOdid(): Promise<string> {
  const { odid } = await chrome.storage.local.get("odid");
  if (odid) return odid;

  const newOdid = crypto.randomUUID();
  await chrome.storage.local.set({ odid: newOdid });
  return newOdid;
}

export async function fetchAllStats(): Promise<ApiResult<AllThemeStats>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/stats`);
    if (!response.ok) {
      const error = `Failed to fetch stats: ${response.status}`;
      console.warn("[ThemeStoreAPI]", error);
      return { success: false, data: {}, error };
    }
    return { success: true, data: await response.json() };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Network error";
    console.warn("[ThemeStoreAPI] Failed to fetch stats:", error);
    return { success: false, data: {}, error };
  }
}

export async function trackInstall(themeId: string): Promise<ApiResult<number | null>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/install/${themeId}`, {
      method: "POST",
    });

    if (response.status === 429) {
      return { success: true, data: null, error: "Rate limited" };
    }

    if (!response.ok) {
      const error = `Failed to track install: ${response.status}`;
      console.warn("[ThemeStoreAPI]", error);
      return { success: false, data: null, error };
    }

    const data = await response.json();
    return { success: true, data: data.count };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Network error";
    console.warn("[ThemeStoreAPI] Failed to track install:", error);
    return { success: false, data: null, error };
  }
}

export async function submitRating(themeId: string, rating: number): Promise<ApiResult<RatingResult | null>> {
  try {
    const odid = await getOdid();
    const response = await fetchWithTimeout(`${API_BASE}/api/rate/${themeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, odid }),
    });

    if (!response.ok) {
      const error = `Failed to submit rating: ${response.status}`;
      console.warn("[ThemeStoreAPI]", error);
      return { success: false, data: null, error };
    }

    return { success: true, data: await response.json() };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Network error";
    console.warn("[ThemeStoreAPI] Failed to submit rating:", error);
    return { success: false, data: null, error };
  }
}

export async function fetchRating(themeId: string): Promise<ApiResult<RatingResult>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/rating/${themeId}`);
    if (!response.ok) {
      return { success: false, data: { average: 0, count: 0 }, error: `HTTP ${response.status}` };
    }
    return { success: true, data: await response.json() };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Network error";
    return { success: false, data: { average: 0, count: 0 }, error };
  }
}
