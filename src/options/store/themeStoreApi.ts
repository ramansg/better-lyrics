import { LOG_PREFIX_STORE, THEME_STORE_API_URL } from "@constants";
import type { AllThemeStats, ApiResult, RatingResult } from "./types";
import { fetchWithTimeout } from "./themeStoreService";
const THEME_ID_MAX_LENGTH = 128;
const THEME_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function isValidThemeId(themeId: string): boolean {
  return (
    typeof themeId === "string" &&
    themeId.length > 0 &&
    themeId.length <= THEME_ID_MAX_LENGTH &&
    THEME_ID_PATTERN.test(themeId)
  );
}

function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
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
    const response = await fetchWithTimeout(`${THEME_STORE_API_URL}/api/stats`);
    if (!response.ok) {
      const error = `Failed to fetch stats: ${response.status}`;
      console.warn(LOG_PREFIX_STORE, error);
      return { success: false, data: {}, error };
    }
    return { success: true, data: await response.json() };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Network error";
    console.warn(LOG_PREFIX_STORE, "Failed to fetch stats:", error);
    return { success: false, data: {}, error };
  }
}

export async function trackInstall(themeId: string): Promise<ApiResult<number | null>> {
  if (!isValidThemeId(themeId)) {
    return { success: false, data: null, error: "Invalid theme ID" };
  }

  try {
    const response = await fetchWithTimeout(`${THEME_STORE_API_URL}/api/install/${encodeURIComponent(themeId)}`, {
      method: "POST",
    });

    if (response.status === 429) {
      return { success: true, data: null, error: "Rate limited" };
    }

    if (!response.ok) {
      const error = `Failed to track install: ${response.status}`;
      console.warn(LOG_PREFIX_STORE, error);
      return { success: false, data: null, error };
    }

    const data = await response.json();
    return { success: true, data: data.count };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Network error";
    console.warn(LOG_PREFIX_STORE, "Failed to track install:", error);
    return { success: false, data: null, error };
  }
}

export async function submitRating(themeId: string, rating: number): Promise<ApiResult<RatingResult | null>> {
  if (!isValidThemeId(themeId)) {
    return { success: false, data: null, error: "Invalid theme ID" };
  }

  if (!isValidRating(rating)) {
    return { success: false, data: null, error: "Rating must be an integer between 1 and 5" };
  }

  try {
    const odid = await getOdid();
    const response = await fetchWithTimeout(`${THEME_STORE_API_URL}/api/rate/${encodeURIComponent(themeId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, odid }),
    });

    if (!response.ok) {
      const error = `Failed to submit rating: ${response.status}`;
      console.warn(LOG_PREFIX_STORE, error);
      return { success: false, data: null, error };
    }

    return { success: true, data: await response.json() };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Network error";
    console.warn(LOG_PREFIX_STORE, "Failed to submit rating:", error);
    return { success: false, data: null, error };
  }
}
