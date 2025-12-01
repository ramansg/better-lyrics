import type { StoreTheme, InstalledStoreTheme } from "./types";
import {
  checkGitHubPermissions,
  requestGitHubPermissions,
  fetchAllStoreThemes,
  fetchFullTheme,
  fetchThemeShaderConfig,
  validateThemeRepo,
  parseGitHubRepoUrl,
} from "./themeStoreService";
import {
  getInstalledStoreThemes,
  isThemeInstalled,
  installTheme,
  removeTheme,
  isVersionCompatible,
  applyStoreTheme,
  getActiveStoreTheme,
  clearActiveStoreTheme,
  performSilentUpdates,
} from "./themeStoreManager";
import { showAlert } from "../editor/ui/feedback";

let storeModalOverlay: HTMLElement | null = null;
let detailModalOverlay: HTMLElement | null = null;
let urlModalOverlay: HTMLElement | null = null;
let currentDetailTheme: StoreTheme | null = null;
let currentSlideIndex = 0;
let storeThemesCache: StoreTheme[] = [];

const EXTENSION_VERSION = chrome.runtime.getManifest().version;

function createShaderIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute("fill-rule", "evenodd");
  path.setAttribute("clip-rule", "evenodd");
  path.setAttribute("d", "M8 2.25A6.75 6.75 0 0 0 1.25 9v6A6.75 6.75 0 0 0 8 21.75h8A6.75 6.75 0 0 0 22.75 15V9A6.75 6.75 0 0 0 16 2.25zm-2 6a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 1.5 0v-2.25h2.821a.75.75 0 0 0 0-1.5H6.75v-1.5H11a.75.75 0 0 0 0-1.5zm7.576.27a.75.75 0 1 0-1.152.96l2.1 2.52l-2.1 2.52a.75.75 0 1 0 1.152.96l1.924-2.308l1.924 2.308a.75.75 0 1 0 1.152-.96l-2.1-2.52l2.1-2.52a.75.75 0 1 0-1.152-.96L15.5 10.829z");
  svg.appendChild(path);
  return svg;
}

function createShaderBadge(className: string): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = className;
  badge.appendChild(createShaderIcon());
  badge.appendChild(document.createTextNode("Shaders"));
  return badge;
}

export function initStoreUI(): void {
  storeModalOverlay = document.getElementById("store-modal-overlay");
  detailModalOverlay = document.getElementById("detail-modal-overlay");
  urlModalOverlay = document.getElementById("url-modal-overlay");

  setupStoreModalListeners();
  setupDetailModalListeners();
  setupUrlModalListeners();
  setupThemeChangeListener();
  setupKeyboardListeners();

  checkForThemeUpdates();
}

async function checkForThemeUpdates(): Promise<void> {
  try {
    const permission = await checkGitHubPermissions();
    if (!permission.granted) return;

    const installed = await getInstalledStoreThemes();
    if (installed.length === 0) return;

    const storeThemes = await fetchAllStoreThemes();
    const updatedIds = await performSilentUpdates(storeThemes);

    if (updatedIds.length > 0) {
      updateYourThemesDropdown();
      await reloadEditorIfActiveThemeUpdated(updatedIds);
    }
  } catch (err) {
    console.warn("[ThemeStore] Update check failed:", err);
  }
}

async function reloadEditorIfActiveThemeUpdated(updatedIds: string[]): Promise<void> {
  const activeThemeId = await getActiveStoreTheme();
  if (!activeThemeId || !updatedIds.includes(activeThemeId)) return;

  const updatedTheme = await getInstalledStoreThemes().then(themes =>
    themes.find(t => t.id === activeThemeId)
  );
  if (!updatedTheme) return;

  document.dispatchEvent(new CustomEvent("store-theme-applied", {
    detail: {
      themeId: updatedTheme.id,
      css: updatedTheme.css,
      title: updatedTheme.title,
    },
  }));
  console.log(`[ThemeStore] Reloaded editor with updated theme: ${updatedTheme.title}`);
}

function setupKeyboardListeners(): void {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const dropdown = document.getElementById("your-themes-dropdown");
      if (dropdown?.classList.contains("active")) {
        e.preventDefault();
        e.stopPropagation();
        toggleYourThemesDropdown(false);
        return;
      }

      if (detailModalOverlay?.classList.contains("active")) {
        e.preventDefault();
        e.stopPropagation();
        closeDetailModal();
      } else if (urlModalOverlay?.classList.contains("active")) {
        e.preventDefault();
        e.stopPropagation();
        closeUrlModal();
      } else if (storeModalOverlay?.classList.contains("active")) {
        e.preventDefault();
        e.stopPropagation();
        closeStoreModal();
      }
      return;
    }

    if (detailModalOverlay?.classList.contains("active")) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateSlide(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateSlide(1);
      }
    }
  });
}

function setupThemeChangeListener(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.themeName) {
      const newThemeName = changes.themeName.newValue;
      if (!newThemeName || !newThemeName.startsWith("store:")) {
        clearActiveStoreTheme().then(() => updateYourThemesDropdown());
      } else {
        updateYourThemesDropdown();
      }
    }
  });
}

function setupStoreModalListeners(): void {
  const closeBtn = document.getElementById("store-modal-close");
  closeBtn?.addEventListener("click", closeStoreModal);

  storeModalOverlay?.addEventListener("click", (e) => {
    if (e.target === storeModalOverlay) closeStoreModal();
  });

  const refreshBtn = document.getElementById("store-refresh-btn");
  refreshBtn?.addEventListener("click", () => refreshStore());

  const retryBtn = document.getElementById("store-retry-btn");
  retryBtn?.addEventListener("click", () => populateStoreModal());
}

function setupDetailModalListeners(): void {
  const closeBtn = document.getElementById("detail-modal-close");
  closeBtn?.addEventListener("click", closeDetailModal);

  detailModalOverlay?.addEventListener("click", (e) => {
    if (e.target === detailModalOverlay) closeDetailModal();
  });

  const prevBtn = document.getElementById("detail-prev-btn");
  const nextBtn = document.getElementById("detail-next-btn");
  prevBtn?.addEventListener("click", () => navigateSlide(-1));
  nextBtn?.addEventListener("click", () => navigateSlide(1));
}

function setupUrlModalListeners(): void {
  const closeBtn = document.getElementById("url-modal-close");
  closeBtn?.addEventListener("click", closeUrlModal);

  urlModalOverlay?.addEventListener("click", (e) => {
    if (e.target === urlModalOverlay) closeUrlModal();
  });

  const cancelBtn = document.getElementById("url-modal-cancel");
  cancelBtn?.addEventListener("click", closeUrlModal);

  const installBtn = document.getElementById("url-modal-install");
  installBtn?.addEventListener("click", handleUrlInstall);

  const input = document.getElementById("url-modal-input") as HTMLInputElement;
  input?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleUrlInstall();
  });
}

export async function openStoreModal(): Promise<void> {
  const permission = await checkGitHubPermissions();

  if (!permission.granted) {
    const granted = await requestGitHubPermissions();
    if (!granted) {
      showAlert("GitHub access is required to browse themes. Please grant permission and try again.");
      return;
    }
  }

  if (storeModalOverlay) {
    storeModalOverlay.style.display = "flex";
    requestAnimationFrame(() => {
      storeModalOverlay?.classList.add("active");
    });
  }

  await populateStoreModal();
}

export function closeStoreModal(): void {
  if (storeModalOverlay) {
    const modal = storeModalOverlay.querySelector(".store-modal");
    modal?.classList.add("closing");
    storeModalOverlay.classList.remove("active");

    setTimeout(() => {
      if (storeModalOverlay) {
        storeModalOverlay.style.display = "none";
        modal?.classList.remove("closing");
      }
    }, 200);
  }
}

async function populateStoreModal(): Promise<void> {
  const grid = document.getElementById("store-modal-grid");
  const loading = document.getElementById("store-loading");
  const error = document.getElementById("store-error");

  if (!grid) return;

  grid.replaceChildren();
  if (loading) loading.style.display = "flex";
  if (error) error.style.display = "none";

  try {
    storeThemesCache = await fetchAllStoreThemes();
    const installedThemes = await getInstalledStoreThemes();
    const installedIds = new Set(installedThemes.map(t => t.id));

    if (loading) loading.style.display = "none";

    if (storeThemesCache.length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "store-empty";
      emptyMsg.textContent = "No themes available yet. Check back later!";
      grid.appendChild(emptyMsg);
      return;
    }

    for (const theme of storeThemesCache) {
      const card = createStoreThemeCard(theme, installedIds.has(theme.id));
      grid.appendChild(card);
    }
  } catch (err) {
    console.error("[ThemeStore] Failed to load themes:", err);
    if (loading) loading.style.display = "none";
    if (error) {
      error.style.display = "block";
      const errorMsg = error.querySelector(".store-error-message");
      if (errorMsg) errorMsg.textContent = `Failed to load themes: ${err}`;
    }
  }
}

function createStoreThemeCard(theme: StoreTheme, isInstalled: boolean): HTMLElement {
  const card = document.createElement("div");
  card.className = "store-card";
  card.dataset.themeId = theme.id;

  const isCompatible = isVersionCompatible(theme.minVersion, EXTENSION_VERSION);

  const coverImg = document.createElement("img");
  coverImg.className = "store-card-cover";
  coverImg.src = theme.coverUrl;
  coverImg.alt = theme.title;
  coverImg.loading = "lazy";
  coverImg.onerror = () => {
    coverImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'%3E%3Crect fill='%23333' width='100' height='60'/%3E%3Ctext x='50' y='35' text-anchor='middle' fill='%23666' font-size='12' font-family='Satoshi,system-ui,-apple-system,sans-serif'%3ENo Preview%3C/text%3E%3C/svg%3E";
  };

  const content = document.createElement("div");
  content.className = "store-card-content";

  const description = document.createElement("p");
  description.className = "store-card-description";
  description.textContent = theme.description.length > 80
    ? theme.description.slice(0, 80) + "..."
    : theme.description;
  description.title = theme.description;

  const info = document.createElement("div");
  info.className = "store-card-info";

  const title = document.createElement("div");
  title.className = "store-card-title";
  title.textContent = theme.title;
  title.title = theme.title;

  const author = document.createElement("div");
  author.className = "store-card-author";
  author.textContent = `By ${theme.creators.join(", ")}`;

  const actionBtn = document.createElement("button");
  actionBtn.className = `store-card-btn ${isInstalled ? "store-card-btn-remove" : "store-card-btn-install"}`;
  actionBtn.textContent = isInstalled ? "Remove" : "Install";
  actionBtn.disabled = !isCompatible && !isInstalled;

  if (!isCompatible && !isInstalled) {
    actionBtn.title = `Requires Better Lyrics v${theme.minVersion}+`;
  }

  actionBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await handleThemeAction(theme, actionBtn);
  });

  info.appendChild(title);
  info.appendChild(author);

  content.appendChild(description);
  content.appendChild(info);
  content.appendChild(actionBtn);

  card.appendChild(coverImg);
  card.appendChild(content);

  card.addEventListener("click", () => openDetailModal(theme));

  if (theme.hasShaders) {
    card.appendChild(createShaderBadge("store-card-badge"));
  }

  if (!isCompatible) {
    const incompatBadge = document.createElement("span");
    incompatBadge.className = "store-card-badge store-card-badge-warn";
    incompatBadge.textContent = `v${theme.minVersion}+`;
    incompatBadge.title = `Requires Better Lyrics v${theme.minVersion} or higher`;
    card.appendChild(incompatBadge);
  }

  return card;
}

async function handleThemeAction(
  theme: StoreTheme,
  button: HTMLButtonElement
): Promise<void> {
  button.disabled = true;
  const currentlyInstalled = await isThemeInstalled(theme.id);
  button.textContent = currentlyInstalled ? "Removing..." : "Installing...";

  try {
    if (currentlyInstalled) {
      await removeTheme(theme.id);
      button.className = "store-card-btn store-card-btn-install";
      button.textContent = "Install";
      showAlert(`Removed "${theme.title}"`);
    } else {
      await installTheme(theme);
      button.className = "store-card-btn store-card-btn-remove";
      button.textContent = "Remove";
      showAlert(`Installed "${theme.title}"`);
    }

    updateYourThemesDropdown();
  } catch (err) {
    console.error("[ThemeStore] Action failed:", err);
    button.textContent = currentlyInstalled ? "Remove" : "Install";
    showAlert(`Failed: ${err}`);
  } finally {
    button.disabled = false;
  }
}

async function openDetailModal(theme: StoreTheme): Promise<void> {
  currentDetailTheme = theme;
  currentSlideIndex = 0;

  if (!detailModalOverlay) return;

  const titleEl = document.getElementById("detail-title");
  const authorEl = document.getElementById("detail-author");
  const descEl = document.getElementById("detail-description");
  const actionBtn = document.getElementById("detail-action-btn") as HTMLButtonElement;
  const shaderInfo = document.getElementById("detail-shader-info");
  const dotsContainer = document.getElementById("detail-dots");

  if (titleEl) {
    titleEl.replaceChildren(document.createTextNode(theme.title));
    if (theme.hasShaders) {
      titleEl.appendChild(createShaderBadge("detail-shader-badge"));
    }
  }
  if (authorEl) authorEl.textContent = `By ${theme.creators.join(", ")} · v${theme.version}`;
  if (descEl) descEl.textContent = theme.description;

  const initialInstalled = await isThemeInstalled(theme.id);

  if (actionBtn) {
    actionBtn.className = `store-card-btn ${initialInstalled ? "store-card-btn-remove" : "store-card-btn-install"}`;
    actionBtn.textContent = initialInstalled ? "Remove" : "Install";
    actionBtn.onclick = async () => {
      actionBtn.disabled = true;
      const currentlyInstalled = await isThemeInstalled(theme.id);
      try {
        if (currentlyInstalled) {
          await removeTheme(theme.id);
          actionBtn.className = "store-card-btn store-card-btn-install";
          actionBtn.textContent = "Install";
          showAlert(`Removed "${theme.title}"`);
        } else {
          await installTheme(theme);
          actionBtn.className = "store-card-btn store-card-btn-remove";
          actionBtn.textContent = "Remove";
          showAlert(`Installed "${theme.title}"`);
        }
        updateYourThemesDropdown();
        await refreshStoreCards();
      } catch (err) {
        showAlert(`Failed: ${err}`);
      } finally {
        actionBtn.disabled = false;
      }
    };
  }

  if (shaderInfo) {
    shaderInfo.style.display = theme.hasShaders ? "flex" : "none";
  }

  const shaderDownloadLink = document.getElementById("detail-shader-download");
  if (shaderDownloadLink && theme.hasShaders) {
    shaderDownloadLink.onclick = async (e) => {
      e.preventDefault();
      try {
        const shaderConfig = await fetchThemeShaderConfig(theme.repo);
        if (!shaderConfig) {
          showAlert("Failed to fetch shader config");
          return;
        }
        const blob = new Blob([JSON.stringify(shaderConfig, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${theme.id}-shader.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        showAlert(`Failed to download: ${err}`);
      }
    };
  }

  if (dotsContainer) {
    dotsContainer.replaceChildren();
    for (let i = 0; i < theme.imageUrls.length; i++) {
      const dot = document.createElement("span");
      dot.className = `detail-dot ${i === 0 ? "active" : ""}`;
      dot.addEventListener("click", () => goToSlide(i));
      dotsContainer.appendChild(dot);
    }
  }

  initSlideshow();

  detailModalOverlay.style.display = "flex";
  requestAnimationFrame(() => {
    detailModalOverlay?.classList.add("active");
  });
}

function closeDetailModal(): void {
  if (detailModalOverlay) {
    const modal = detailModalOverlay.querySelector(".detail-modal");
    modal?.classList.add("closing");
    detailModalOverlay.classList.remove("active");

    setTimeout(() => {
      if (detailModalOverlay) {
        detailModalOverlay.style.display = "none";
        modal?.classList.remove("closing");
      }
    }, 200);
  }
}

let slideshowImages: HTMLImageElement[] = [];

function initSlideshow(): void {
  if (!currentDetailTheme) return;

  const container = document.getElementById("detail-slideshow-container");
  if (!container) return;

  container.replaceChildren();
  slideshowImages = [];

  currentDetailTheme.imageUrls.forEach((url, index) => {
    const img = document.createElement("img");
    img.className = "detail-slideshow-img";
    img.src = url;
    img.alt = `Preview ${index + 1}`;
    img.draggable = false;
    img.onerror = () => {
      img.style.display = "none";
    };

    if (index === 0) {
      img.classList.add("current");
    } else {
      img.classList.add("next");
    }

    container.appendChild(img);
    slideshowImages.push(img);
  });

  updateSlideshowState();
}

function updateSlideshowState(): void {
  if (!currentDetailTheme) return;

  slideshowImages.forEach((img, index) => {
    img.classList.remove("prev", "current", "next");
    if (index < currentSlideIndex) {
      img.classList.add("prev");
    } else if (index === currentSlideIndex) {
      img.classList.add("current");
    } else {
      img.classList.add("next");
    }
  });

  const dots = document.querySelectorAll(".detail-dot");
  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === currentSlideIndex);
  });

  const prevBtn = document.getElementById("detail-prev-btn");
  const nextBtn = document.getElementById("detail-next-btn");
  if (prevBtn) prevBtn.classList.toggle("disabled", currentSlideIndex === 0);
  if (nextBtn) {
    nextBtn.classList.toggle(
      "disabled",
      currentSlideIndex === currentDetailTheme.imageUrls.length - 1
    );
  }
}

function navigateSlide(direction: number): void {
  if (!currentDetailTheme) return;

  const newIndex = currentSlideIndex + direction;
  if (newIndex >= 0 && newIndex < currentDetailTheme.imageUrls.length) {
    currentSlideIndex = newIndex;
    updateSlideshowState();
  }
}

function goToSlide(index: number): void {
  if (index === currentSlideIndex) return;
  currentSlideIndex = index;
  updateSlideshowState();
}

export function openUrlModal(): void {
  if (urlModalOverlay) {
    const input = document.getElementById("url-modal-input") as HTMLInputElement;
    if (input) input.value = "";

    const error = document.getElementById("url-modal-error");
    if (error) error.style.display = "none";

    urlModalOverlay.style.display = "flex";
    requestAnimationFrame(() => {
      urlModalOverlay?.classList.add("active");
      input?.focus();
    });
  }
}

function closeUrlModal(): void {
  if (urlModalOverlay) {
    const modal = urlModalOverlay.querySelector(".modal");
    modal?.classList.add("closing");
    urlModalOverlay.classList.remove("active");

    setTimeout(() => {
      if (urlModalOverlay) {
        urlModalOverlay.style.display = "none";
        modal?.classList.remove("closing");
      }
    }, 200);
  }
}

async function handleUrlInstall(): Promise<void> {
  const input = document.getElementById("url-modal-input") as HTMLInputElement;
  const error = document.getElementById("url-modal-error");
  const installBtn = document.getElementById("url-modal-install") as HTMLButtonElement;

  if (!input || !installBtn) return;

  const url = input.value.trim();
  if (!url) {
    if (error) {
      error.textContent = "Please enter a GitHub repository URL";
      error.style.display = "block";
    }
    return;
  }

  const repo = parseGitHubRepoUrl(url);
  if (!repo) {
    if (error) {
      error.textContent = "Invalid GitHub URL. Use format: github.com/user/repo or user/repo";
      error.style.display = "block";
    }
    return;
  }

  installBtn.disabled = true;
  installBtn.textContent = "Validating...";
  if (error) error.style.display = "none";

  try {
    const permission = await checkGitHubPermissions();
    if (!permission.granted) {
      const granted = await requestGitHubPermissions();
      if (!granted) {
        throw new Error("GitHub access required");
      }
    }

    const validation = await validateThemeRepo(repo);
    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }

    installBtn.textContent = "Installing...";

    const theme = await fetchFullTheme(repo);
    await installTheme(theme);

    showAlert(`Installed "${theme.title}" from ${repo}`);
    closeUrlModal();
    updateYourThemesDropdown();
  } catch (err) {
    console.error("[ThemeStore] URL install failed:", err);
    if (error) {
      error.textContent = `${err}`;
      error.style.display = "block";
    }
  } finally {
    installBtn.disabled = false;
    installBtn.textContent = "Install";
  }
}

export async function updateYourThemesDropdown(): Promise<void> {
  const dropdown = document.getElementById("your-themes-dropdown");
  if (!dropdown) return;

  const installed = await getInstalledStoreThemes();
  const storedActiveThemeId = await getActiveStoreTheme();

  const syncData = await chrome.storage.sync.get("themeName");
  const currentThemeName = syncData.themeName as string | undefined;
  const isStoreThemeActive = currentThemeName?.startsWith("store:");
  const activeThemeId = isStoreThemeActive ? currentThemeName?.slice(6) : null;

  if (storedActiveThemeId && storedActiveThemeId !== activeThemeId) {
    await clearActiveStoreTheme();
  }

  dropdown.replaceChildren();

  if (installed.length === 0) {
    const empty = document.createElement("div");
    empty.className = "your-themes-empty";
    empty.textContent = "No themes installed yet";
    dropdown.appendChild(empty);
    return;
  }

  for (const theme of installed) {
    const item = document.createElement("div");
    item.className = `your-themes-item ${theme.id === activeThemeId ? "active" : ""}`;

    const info = document.createElement("div");
    info.className = "your-themes-item-info";

    const title = document.createElement("span");
    title.className = "your-themes-item-title";
    title.textContent = theme.title;

    const meta = document.createElement("span");
    meta.className = "your-themes-item-meta";
    meta.textContent = `By ${theme.creators.join(", ")} · v${theme.version}`;

    info.appendChild(title);
    info.appendChild(meta);

    const applyBtn = document.createElement("button");
    applyBtn.className = "your-themes-item-apply";
    applyBtn.textContent = theme.id === activeThemeId ? "Active" : "Apply";
    applyBtn.disabled = theme.id === activeThemeId;
    applyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await handleApplyTheme(theme);
    });

    item.appendChild(info);
    item.appendChild(applyBtn);
    item.addEventListener("click", () => handleApplyTheme(theme));

    dropdown.appendChild(item);
  }
}

async function handleApplyTheme(theme: InstalledStoreTheme): Promise<void> {
  try {
    const css = await applyStoreTheme(theme.id);

    const themeContent = `/* ${theme.title}, a store theme by ${theme.creators.join(", ")} */\n\n${css}\n`;

    await chrome.storage.sync.set({ themeName: `store:${theme.id}` });

    const event = new CustomEvent("store-theme-applied", {
      detail: { themeId: theme.id, css: themeContent, title: theme.title },
    });
    document.dispatchEvent(event);

    showAlert(`Applied "${theme.title}"`);
    updateYourThemesDropdown();
    toggleYourThemesDropdown(false);
  } catch (err) {
    console.error("[ThemeStore] Failed to apply theme:", err);
    showAlert(`Failed to apply theme: ${err}`);
  }
}

export function toggleYourThemesDropdown(show?: boolean): void {
  const dropdown = document.getElementById("your-themes-dropdown");
  const btn = document.getElementById("your-themes-btn");

  if (!dropdown || !btn) return;

  const isVisible = dropdown.classList.contains("active");
  const shouldShow = show !== undefined ? show : !isVisible;

  if (shouldShow) {
    dropdown.classList.add("active");
    btn.classList.add("active");
    updateYourThemesDropdown();
  } else {
    dropdown.classList.remove("active");
    btn.classList.remove("active");
  }
}

async function refreshStore(): Promise<void> {
  const grid = document.getElementById("store-modal-grid");
  if (grid) grid.replaceChildren();
  storeThemesCache = [];
  await populateStoreModal();
  await checkForThemeUpdates();
}

async function refreshStoreCards(): Promise<void> {
  const installedThemes = await getInstalledStoreThemes();
  const installedIds = new Set(installedThemes.map(t => t.id));

  const cards = document.querySelectorAll(".store-card");
  cards.forEach(card => {
    const themeId = (card as HTMLElement).dataset.themeId;
    if (!themeId) return;

    const btn = card.querySelector(".store-card-btn") as HTMLButtonElement;
    if (!btn) return;

    const isInstalled = installedIds.has(themeId);
    btn.className = `store-card-btn ${isInstalled ? "store-card-btn-remove" : "store-card-btn-install"}`;
    btn.textContent = isInstalled ? "Remove" : "Install";
  });
}

export function setupYourThemesButton(): void {
  const btn = document.getElementById("your-themes-btn");
  btn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleYourThemesDropdown();
  });

  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("your-themes-dropdown");
    const btn = document.getElementById("your-themes-btn");
    if (dropdown && btn && !dropdown.contains(e.target as Node) && !btn.contains(e.target as Node)) {
      toggleYourThemesDropdown(false);
    }
  });
}
