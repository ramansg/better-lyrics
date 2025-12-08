/**
 * Handles runtime messages from extension components.
 * Processes CSS updates for YouTube Music tabs and settings updates.
 *
 * @param {Object} request - The message request object
 * @param {string} request.action - The action type ('updateCSS' or 'updateSettings')
 * @param {string} [request.css] - CSS content for updateCSS action
 * @param {Object} [request.settings] - Settings object for updateSettings action
 * @returns {boolean} Returns true to indicate asynchronous response
 */
import { getInstalledStoreThemes, performSilentUpdates, performUrlThemeUpdates } from "./store/themeStoreManager";
import { checkStorePermissions, fetchAllStoreThemes } from "./store/themeStoreService";

const THEME_UPDATE_ALARM = "theme-update-check";
const UPDATE_INTERVAL_MINUTES = 360; // 6 hours
const LOG_PREFIX = "[BetterLyrics:Background]";

async function checkAndApplyThemeUpdates(): Promise<void> {
  try {
    const permission = await checkStorePermissions();
    if (!permission.granted) return;

    const installed = await getInstalledStoreThemes();
    if (installed.length === 0) return;

    console.log(LOG_PREFIX, "Checking for theme updates...");
    const storeThemes = await fetchAllStoreThemes();
    const marketplaceUpdatedIds = await performSilentUpdates(storeThemes);
    const urlUpdatedIds = await performUrlThemeUpdates();
    const updatedIds = [...marketplaceUpdatedIds, ...urlUpdatedIds];

    if (updatedIds.length > 0) {
      console.log(LOG_PREFIX, `Updated ${updatedIds.length} theme(s):`, updatedIds.join(", "));
    }
  } catch (err) {
    console.warn(LOG_PREFIX, "Theme update check failed:", err);
  }
}

function setupThemeUpdateAlarm(): void {
  chrome.alarms.get(THEME_UPDATE_ALARM, existingAlarm => {
    if (!existingAlarm) {
      chrome.alarms.create(THEME_UPDATE_ALARM, {
        delayInMinutes: 1,
        periodInMinutes: UPDATE_INTERVAL_MINUTES,
      });
      console.log(LOG_PREFIX, "Theme update alarm created");
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupThemeUpdateAlarm();
  checkAndApplyThemeUpdates();
});

chrome.runtime.onStartup.addListener(() => {
  setupThemeUpdateAlarm();
  checkAndApplyThemeUpdates();
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === THEME_UPDATE_ALARM) {
    checkAndApplyThemeUpdates();
  }
});

chrome.runtime.onMessage.addListener(request => {
  if (request.action === "updateCSS") {
    chrome.tabs.query({ url: "*://music.youtube.com/*" }, tabs => {
      tabs.forEach(tab => {
        if (tab.id != null) {
          chrome.tabs.sendMessage(tab.id, { action: "updateCSS", css: request.css }).catch(() => {});
        }
      });
    });
  }
  return true;
});
