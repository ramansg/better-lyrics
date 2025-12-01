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
import { getActiveStoreTheme, getInstalledStoreThemes, getInstalledTheme, performSilentUpdates } from "./store/themeStoreManager";
import { checkGitHubPermissions, fetchAllStoreThemes } from "./store/themeStoreService";

const THEME_UPDATE_ALARM = "theme-update-check";
const UPDATE_INTERVAL_MINUTES = 360; // 6 hours

async function checkAndApplyThemeUpdates(): Promise<void> {
  try {
    const permission = await checkGitHubPermissions();
    if (!permission.granted) return;

    const installed = await getInstalledStoreThemes();
    if (installed.length === 0) return;

    console.log("[BetterLyrics] Checking for theme updates...");
    const storeThemes = await fetchAllStoreThemes();
    const updatedIds = await performSilentUpdates(storeThemes);

    if (updatedIds.length > 0) {
      console.log(`[BetterLyrics] Updated ${updatedIds.length} theme(s)`);

      const activeThemeId = await getActiveStoreTheme();
      if (activeThemeId && updatedIds.includes(activeThemeId)) {
        const updatedTheme = await getInstalledTheme(activeThemeId);
        if (updatedTheme) {
          chrome.tabs.query({ url: "*://music.youtube.com/*" }, tabs => {
            tabs.forEach(tab => {
              if (tab.id != null) {
                chrome.tabs.sendMessage(tab.id, { action: "updateCSS", css: updatedTheme.css }).catch(() => {});
              }
            });
          });
        }
      }
    }
  } catch (err) {
    console.warn("[BetterLyrics] Theme update check failed:", err);
  }
}

function setupThemeUpdateAlarm(): void {
  chrome.alarms.get(THEME_UPDATE_ALARM, (existingAlarm) => {
    if (!existingAlarm) {
      chrome.alarms.create(THEME_UPDATE_ALARM, {
        delayInMinutes: 1,
        periodInMinutes: UPDATE_INTERVAL_MINUTES,
      });
      console.log("[BetterLyrics] Theme update alarm created");
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === THEME_UPDATE_ALARM) {
    checkAndApplyThemeUpdates();
  }
});

chrome.runtime.onMessage.addListener(request => {
  if (request.action === "updateCSS") {
    chrome.tabs.query({ url: "*://music.youtube.com/*" }, tabs => {
      tabs.forEach(tab => {
        if (tab.id != null) {
          chrome.tabs.sendMessage(tab.id, { action: "updateCSS", css: request.css }).catch(error => {
            console.log(`[BetterLyrics] (Safe to ignore) Error sending message to tab ${tab.id}:`, error);
          });
        } else {
          console.log("[BetterLyrics] TabId is null");
        }
      });
    });
  } else if (request.action === "updateSettings") {
    console.log("[BetterLyrics] Update Settings Message");
  }
  return true;
});
