import type { EditorView } from "@codemirror/view";

const SAVE_DECAY_TIMEOUT = 5000;

export let editor: EditorView;
export let currentThemeName: string | null = null;
export let isUserTyping = false;
export let isCustomTheme = false;
export let saveTimeout: number;
export let saveCustomThemeTimeout: number;

let saveCount = 0;
const saveDecayTimes: number[] = [];

export function setEditor(newEditor: EditorView): void {
  editor = newEditor;
}

export function setCurrentThemeName(name: string | null): void {
  currentThemeName = name;
}

export function setIsUserTyping(value: boolean): void {
  isUserTyping = value;
}

export function setIsCustomTheme(value: boolean): void {
  isCustomTheme = value;
}

function decaySaveCounts(): void {
  const now = Date.now();
  let expiredCount = 0;

  for (; expiredCount < saveDecayTimes.length; expiredCount++) {
    if (saveDecayTimes[expiredCount] > now) {
      break;
    }
  }

  saveDecayTimes.splice(0, expiredCount);
  saveCount = Math.max(saveCount - expiredCount, 0);
}

export function incrementSaveCount(): void {
  decaySaveCounts();
  const decayTime = Date.now() + SAVE_DECAY_TIMEOUT;
  saveDecayTimes.push(decayTime);
  saveCount++;
}

export function decrementSaveCount(): void {
  decaySaveCounts();
  if (saveDecayTimes.length > 0) {
    saveDecayTimes.shift();
  }
  saveCount = Math.max(saveCount - 1, 0);
}

export function getSaveCount(): number {
  decaySaveCounts();
  return saveCount;
}

export function setSaveTimeout(timeout: number): void {
  saveTimeout = timeout;
}

export function setSaveCustomThemeTimeout(timeout: number): void {
  saveCustomThemeTimeout = timeout;
}
