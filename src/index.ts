import { DEFAULT_LINE_SYNCED_WORD_DELAY_MS, GENERAL_ERROR_LOG, INITIALIZE_LOG } from "@constants";
import { purgeExpiredKeys, saveCacheInfo } from "@core/storage";
import { subscribeToCustomStyles } from "@modules/ui/styleInjector";
import type { LyricsData } from "@modules/lyrics/injectLyrics";
import { createLyrics } from "@modules/lyrics/lyrics";
import { initProviders } from "@modules/lyrics/providers/shared";
import { setupRequestSniffer } from "@modules/lyrics/requestSniffer";
import {
  handleSettings,
  hideCursorOnIdle,
  listenForPopupMessages,
  loadTranslationSettings,
  onAlbumArtEnabled,
} from "@modules/settings/settings";
import { injectHeadTags } from "@modules/ui/dom";
import { disableInertWhenFullscreen, enableLyricsTab, initializeLyrics, lyricReloader } from "@modules/ui/observer";
import { log, setUpLog } from "@utils";

export interface PlayerDetails {
  currentTime: number;
  videoId: string;
  song: string;
  artist: string;
  duration: string;
  audioTrackData: any;
  browserTime: number;
  playing: boolean;
  contentRect: {
    width: number;
    height: number;
  };
}

interface AppState {
  suppressZeroTime: number;
  areLyricsTicking: boolean;
  lyricData: LyricsData | null;
  areLyricsLoaded: boolean;
  lyricInjectionFailed: boolean;
  lastVideoId: string | null;
  lastVideoDetails: any | null;
  lyricInjectionPromise: Promise<any> | null;
  queueLyricInjection: boolean;
  queueAlbumArtInjection: boolean;
  shouldInjectAlbumArt: string | boolean;
  queueSongDetailsInjection: boolean;
  loaderAnimationEndTimeout: number | undefined;
  lastLoadedVideoId: string | null;
  lyricAbortController: AbortController | null;
  animationSettings: {
    disableRichSynchronization: boolean;
    lineSyncedWordDelayMs: number;
  };
  isTranslateEnabled: boolean;
  isRomanizationEnabled: boolean;
  translationLanguage: string;
}

export let AppState: AppState = {
  suppressZeroTime: 0,
  areLyricsTicking: false,
  lyricData: null,
  areLyricsLoaded: false,
  lyricInjectionFailed: false,
  lastVideoId: null,
  lastVideoDetails: null,
  lyricInjectionPromise: null,
  queueLyricInjection: false,
  queueAlbumArtInjection: false,
  shouldInjectAlbumArt: "Unknown",
  queueSongDetailsInjection: false,
  loaderAnimationEndTimeout: undefined,
  lastLoadedVideoId: null,
  lyricAbortController: null,
  animationSettings: {
    disableRichSynchronization: false,
    lineSyncedWordDelayMs: DEFAULT_LINE_SYNCED_WORD_DELAY_MS,
  },
  isTranslateEnabled: false,
  isRomanizationEnabled: false,
  translationLanguage: "en",
};

/**
 * Initializes the BetterLyrics extension by setting up all required components.
 * This method orchestrates the setup of logging, DOM injection, observers, settings,
 * storage, and lyric providers.
 */
export async function modify(): Promise<void> {
  setUpLog();
  await injectHeadTags();
  enableLyricsTab();
  hideCursorOnIdle();
  handleSettings();
  loadTranslationSettings();
  subscribeToCustomStyles();
  await purgeExpiredKeys();
  await saveCacheInfo();
  listenForPopupMessages();
  lyricReloader();
  initializeLyrics();
  disableInertWhenFullscreen();
  initProviders();
  log(
    INITIALIZE_LOG,
    "background: rgba(10,11,12,1) ; color: rgba(214, 250, 214,1) ; padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 1rem; "
  );

  onAlbumArtEnabled(
    () => (AppState.shouldInjectAlbumArt = true),
    () => (AppState.shouldInjectAlbumArt = false)
  );
}

/**
 * Handles modifications to player state and manages lyric injection.
 * Ensures only one lyric injection process runs at a time by queueing subsequent calls.
 *
 * @param detail - Player state details
 */
export function handleModifications(detail: PlayerDetails): void {
  if (AppState.lyricInjectionPromise) {
    AppState.lyricAbortController?.abort("New song is being loaded");
    AppState.lyricInjectionPromise.then(() => {
      AppState.lyricInjectionPromise = null;
      handleModifications(detail);
    });
  } else {
    AppState.lyricAbortController = new AbortController();
    AppState.lyricInjectionPromise = createLyrics(detail, AppState.lyricAbortController.signal).catch(err => {
      log(GENERAL_ERROR_LOG, err);
      AppState.areLyricsLoaded = false;
      AppState.lyricInjectionFailed = true;
    });
  }
}

/**
 * Reloads lyrics by resetting the last video ID.
 * Forces the extension to re-fetch lyrics for the current video.
 */
export function reloadLyrics(): void {
  AppState.lastVideoId = null;
}

/**
 * Initializes the application by setting up the DOM content loaded event listener.
 * Entry point for the BetterLyrics extension.
 */
export function init(): void {
  document.addEventListener("DOMContentLoaded", modify);
}

// Initialize the application
init();

setupRequestSniffer();
