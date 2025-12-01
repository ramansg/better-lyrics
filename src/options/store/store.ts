import { marked } from "marked";
import type { StoreTheme, InstalledStoreTheme, AllThemeStats, ThemeStats } from "./types";
import {
  checkStorePermissions,
  requestStorePermissions,
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
import { fetchAllStats, trackInstall, submitRating } from "./themeStoreApi";
import { showAlert } from "../editor/ui/feedback";

let detailModalOverlay: HTMLElement | null = null;
let urlModalOverlay: HTMLElement | null = null;
let currentDetailTheme: StoreTheme | null = null;
let currentSlideIndex = 0;
let storeThemesCache: StoreTheme[] = [];
let storeStatsCache: AllThemeStats = {};
let userRatingsCache: Record<string, number> = {};
let userInstallsCache: Record<string, boolean> = {};

async function loadUserRatings(): Promise<void> {
  const { userThemeRatings } = await chrome.storage.local.get("userThemeRatings");
  userRatingsCache = userThemeRatings || {};
}

async function saveUserRating(themeId: string, rating: number): Promise<void> {
  userRatingsCache[themeId] = rating;
  await chrome.storage.local.set({ userThemeRatings: userRatingsCache });
}

async function loadUserInstalls(): Promise<void> {
  const { userThemeInstalls } = await chrome.storage.local.get("userThemeInstalls");
  userInstallsCache = userThemeInstalls || {};
}

async function markUserInstall(themeId: string): Promise<void> {
  userInstallsCache[themeId] = true;
  await chrome.storage.local.set({ userThemeInstalls: userInstallsCache });
}

interface FilterState {
  searchQuery: string;
  sortBy: "rating" | "downloads" | "newest";
  showFilter: "all" | "installed" | "not-installed";
  hasShaders: boolean;
  versionCompatible: boolean;
}

let currentFilters: FilterState = {
  searchQuery: "",
  sortBy: "rating",
  showFilter: "all",
  hasShaders: false,
  versionCompatible: true,
};

const EXTENSION_VERSION = chrome.runtime.getManifest().version;
const ITEMS_PER_PAGE = 12;
let currentPage = 1;
let isMarketplacePage = false;

let TEST_THEMES_ENABLED = false;
try {
  TEST_THEMES_ENABLED = process.env.EXTENSION_PUBLIC_ENABLE_TEST_THEMES === "true";
} catch {
  // process.env not available, keep test themes disabled
}

function getTestThemes(): StoreTheme[] {
  if (!TEST_THEMES_ENABLED) return [];

  const placeholderImage = "https://placehold.co/400x240/333333/666666?text=Preview";

  const coloredImages = [
    "https://placehold.co/400x240/cc4444/ffffff?text=Image+1",
    "https://placehold.co/400x240/44cc44/ffffff?text=Image+2",
    "https://placehold.co/400x240/4444cc/ffffff?text=Image+3",
    "https://placehold.co/400x240/cc44cc/ffffff?text=Image+4",
  ];

  return [
    {
      id: "test-basic",
      title: "Basic Theme",
      description: "A simple theme with minimal features. No shaders, just clean styling.",
      creators: ["Test Author"],
      version: "1.0.0",
      minVersion: "2.0.0",
      hasShaders: false,
      repo: "test/basic-theme",
      coverUrl: placeholderImage,
      imageUrls: [placeholderImage],
      cssUrl: "",
    },
    {
      id: "test-markdown",
      title: "Markdown Description",
      description:
        "This theme has a **rich markdown description** with various formatting.\n\n## Features\n\n- Custom fonts and typography\n- Gradient backgrounds\n- Smooth animations\n- Dark mode optimized\n\n### Installation Notes\n\nCheck out the `code styling` and [documentation](https://example.com).\n\n> This is a blockquote for additional context about the theme.",
      creators: ["Markdown Master"],
      version: "1.5.0",
      minVersion: "2.0.0",
      hasShaders: false,
      repo: "test/markdown-theme",
      coverUrl: placeholderImage,
      imageUrls: [placeholderImage],
      cssUrl: "",
    },
    {
      id: "test-markdown-images",
      title: "Markdown + Inline Images",
      description:
        "A theme showcasing **markdown description** with embedded images.\n\n## Preview\n\n![Main Preview](https://placehold.co/600x300/1a1a2e/ffffff?text=Main+Preview)\n\n## Features\n\n- Custom color palette\n- Animated transitions\n- Responsive design\n\n### Light Mode\n\n![Light Mode](https://placehold.co/400x200/f0f0f0/333333?text=Light+Mode)\n\n### Dark Mode\n\n![Dark Mode](https://placehold.co/400x200/1a1a2e/ffffff?text=Dark+Mode)\n\n## Installation\n\nSimply click install and enjoy!",
      creators: ["Gallery Designer"],
      version: "2.0.0",
      minVersion: "2.0.0",
      hasShaders: false,
      repo: "test/markdown-gallery-theme",
      coverUrl: coloredImages[0],
      imageUrls: coloredImages,
      cssUrl: "",
    },
    {
      id: "test-multi-image",
      title: "Multi-Image Gallery",
      description: "A theme with multiple preview images to showcase different views and states.",
      creators: ["Gallery Pro"],
      version: "1.0.0",
      minVersion: "2.0.0",
      hasShaders: false,
      repo: "test/gallery-theme",
      coverUrl: coloredImages[0],
      imageUrls: coloredImages.slice(0, 3),
      cssUrl: "",
    },
    {
      id: "test-with-shader",
      title: "Shader Theme",
      description:
        "This theme includes **custom shaders** for enhanced visual effects.\n\nFeatures:\n- Blur effects\n- Color grading\n- Animated backgrounds",
      creators: ["Shader Dev"],
      version: "2.1.0",
      minVersion: "2.0.0",
      hasShaders: true,
      repo: "test/shader-theme",
      coverUrl: placeholderImage,
      imageUrls: [placeholderImage],
      cssUrl: "",
      shaderUrl: "",
    },
    {
      id: "test-incompatible",
      title: "Incompatible Theme",
      description: "This theme requires a newer version of Better Lyrics. Update to use this theme.",
      creators: ["Future Dev"],
      version: "1.0.0",
      minVersion: "99.0.0",
      hasShaders: false,
      repo: "test/future-theme",
      coverUrl: placeholderImage,
      imageUrls: [placeholderImage],
      cssUrl: "",
    },
    {
      id: "test-multi-author",
      title: "Collaboration Theme",
      description: "Created by multiple authors working together on a shared vision.",
      creators: ["Alice", "Bob", "Charlie"],
      version: "3.0.0",
      minVersion: "2.0.0",
      hasShaders: true,
      repo: "test/collab-theme",
      coverUrl: placeholderImage,
      imageUrls: [placeholderImage],
      cssUrl: "",
      shaderUrl: "",
    },
    {
      id: "test-long-description",
      title: "Long Description Theme",
      description:
        "This theme has a very detailed description that spans multiple paragraphs to test how the UI handles longer content.\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.\n\n**Key Features:**\n\n1. Custom color palette with 12 accent colors\n2. Animated transitions for all interactive elements\n3. Fully responsive design that works on all screen sizes\n4. Dark mode support with automatic switching\n5. High contrast accessibility mode\n\nFor more information, visit [our website](https://example.com) or check out the [full documentation](https://docs.example.com).\n\n---\n\n*Last updated: December 2024*",
      creators: ["Verbose Author"],
      version: "2.0.0",
      minVersion: "2.0.0",
      hasShaders: false,
      repo: "test/long-theme",
      coverUrl: placeholderImage,
      imageUrls: [placeholderImage],
      cssUrl: "",
    },
  ];
}

function getTestStats(): AllThemeStats {
  if (!TEST_THEMES_ENABLED) return {};

  return {
    "test-basic": { installs: 150, rating: 4.0, ratingCount: 80 },
    "test-markdown": { installs: 500, rating: 4.5, ratingCount: 200 },
    "test-markdown-images": { installs: 1200, rating: 4.8, ratingCount: 450 },
    "test-multi-image": { installs: 800, rating: 4.2, ratingCount: 300 },
    "test-with-shader": { installs: 2500, rating: 4.5, ratingCount: 1000 },
    "test-incompatible": { installs: 50, rating: 4.0, ratingCount: 50 },
    "test-multi-author": { installs: 3000, rating: 4.0, ratingCount: 3500 },
    "test-long-description": { installs: 600, rating: 4.3, ratingCount: 180 },
  };
}

marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderer = new marked.Renderer();
renderer.link = ({ href, text }) => {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
};
marked.use({ renderer });

function parseMarkdown(text: string): DocumentFragment {
  const html = marked.parse(text, { async: false }) as string;
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content;
}

function createShaderIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute("fill-rule", "evenodd");
  path.setAttribute("clip-rule", "evenodd");
  path.setAttribute(
    "d",
    "M8 2.25A6.75 6.75 0 0 0 1.25 9v6A6.75 6.75 0 0 0 8 21.75h8A6.75 6.75 0 0 0 22.75 15V9A6.75 6.75 0 0 0 16 2.25zm-2 6a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 1.5 0v-2.25h2.821a.75.75 0 0 0 0-1.5H6.75v-1.5H11a.75.75 0 0 0 0-1.5zm7.576.27a.75.75 0 1 0-1.152.96l2.1 2.52l-2.1 2.52a.75.75 0 1 0 1.152.96l1.924-2.308l1.924 2.308a.75.75 0 1 0 1.152-.96l-2.1-2.52l2.1-2.52a.75.75 0 1 0-1.152-.96L15.5 10.829z"
  );
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

function createDownloadIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("fill", "currentColor");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75ZM3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z"
  );
  svg.appendChild(path);
  return svg;
}

function createStarIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("fill", "currentColor");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill-rule", "evenodd");
  path.setAttribute("clip-rule", "evenodd");
  path.setAttribute(
    "d",
    "M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
  );
  svg.appendChild(path);
  return svg;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

export function initStoreUI(): void {
  detailModalOverlay = document.getElementById("detail-modal-overlay");
  urlModalOverlay = document.getElementById("url-modal-overlay");

  setupDetailModalListeners();
  setupUrlModalListeners();
  setupThemeChangeListener();
  setupKeyboardListeners();

  loadUserRatings();
  loadUserInstalls();
  setTimeout(checkForThemeUpdates, 500);
}

export async function initMarketplaceUI(): Promise<void> {
  detailModalOverlay = document.getElementById("detail-modal-overlay");
  urlModalOverlay = document.getElementById("url-modal-overlay");
  isMarketplacePage = true;

  setupMarketplaceListeners();
  setupDetailModalListeners();
  setupUrlModalListeners();
  setupMarketplaceKeyboardListeners();
  setupPaginationListeners();

  await loadUserRatings();
  await loadUserInstalls();
  await loadMarketplace();
}

function setupMarketplaceListeners(): void {
  const refreshBtn = document.getElementById("store-refresh-btn");
  refreshBtn?.addEventListener("click", () => refreshMarketplace());

  const retryBtn = document.getElementById("store-retry-btn");
  retryBtn?.addEventListener("click", () => loadMarketplace());

  const urlInstallBtn = document.getElementById("url-install-btn");
  urlInstallBtn?.addEventListener("click", () => openUrlModal());

  setupMarketplaceFilters();
}

function setupMarketplaceFilters(): void {
  const searchInput = document.getElementById("store-search-input") as HTMLInputElement;
  const sortRadios = document.querySelectorAll('input[name="store-filter-sort"]');
  const showRadios = document.querySelectorAll('input[name="store-filter-show"]');
  const shaderCheckbox = document.getElementById("store-filter-shaders") as HTMLInputElement;
  const compatibleCheckbox = document.getElementById("store-filter-compatible") as HTMLInputElement;

  searchInput?.addEventListener("input", () => {
    currentFilters.searchQuery = searchInput.value.trim().toLowerCase();
    currentPage = 1;
    applyFiltersToGrid();
  });

  sortRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      currentFilters.sortBy = (radio as HTMLInputElement).value as FilterState["sortBy"];
      currentPage = 1;
      applyFiltersToGrid();
    });
  });

  showRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      currentFilters.showFilter = (radio as HTMLInputElement).value as FilterState["showFilter"];
      currentPage = 1;
      applyFiltersToGrid();
    });
  });

  shaderCheckbox?.addEventListener("change", () => {
    currentFilters.hasShaders = shaderCheckbox.checked;
    currentPage = 1;
    applyFiltersToGrid();
  });

  compatibleCheckbox?.addEventListener("change", () => {
    currentFilters.versionCompatible = compatibleCheckbox.checked;
    currentPage = 1;
    applyFiltersToGrid();
  });
}

function setupPaginationListeners(): void {
  const prevBtn = document.getElementById("pagination-prev");
  const nextBtn = document.getElementById("pagination-next");

  prevBtn?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      applyFiltersToGrid();
      scrollToTop();
    }
  });

  nextBtn?.addEventListener("click", () => {
    currentPage++;
    applyFiltersToGrid();
    scrollToTop();
  });
}

function scrollToTop(): void {
  const content = document.querySelector(".marketplace-content");
  content?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupMarketplaceKeyboardListeners(): void {
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (detailModalOverlay?.classList.contains("active")) {
        e.preventDefault();
        closeDetailModal();
      } else if (urlModalOverlay?.classList.contains("active")) {
        e.preventDefault();
        closeUrlModal();
      }
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

async function loadMarketplace(): Promise<void> {
  const grid = document.getElementById("store-modal-grid");
  const loading = document.getElementById("store-loading");
  const error = document.getElementById("store-error");

  if (!grid) return;

  grid.replaceChildren();
  if (loading) loading.style.display = "flex";
  if (error) error.style.display = "none";

  try {
    const permission = await checkStorePermissions();
    if (!permission.granted) {
      const granted = await requestStorePermissions();
      if (!granted) {
        throw new Error("GitHub access is required to browse themes");
      }
    }

    const [themes, installedThemes, statsResult] = await Promise.all([
      fetchAllStoreThemes(),
      getInstalledStoreThemes(),
      fetchAllStats(),
    ]);

    storeThemesCache = [...themes, ...getTestThemes()];
    storeStatsCache = { ...statsResult.data, ...getTestStats() };
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
      const themeStats = storeStatsCache[theme.id];
      const card = createStoreThemeCard(theme, installedIds.has(theme.id), themeStats);
      grid.appendChild(card);
    }

    applyFiltersToGrid();
  } catch (err) {
    console.error("[Marketplace] Failed to load themes:", err);
    if (loading) loading.style.display = "none";
    if (error) {
      error.style.display = "flex";
      const errorMsg = error.querySelector(".store-error-message");
      if (errorMsg) errorMsg.textContent = `Failed to load themes: ${err}`;
    }
  }
}

async function refreshMarketplace(): Promise<void> {
  const grid = document.getElementById("store-modal-grid");
  if (grid) grid.replaceChildren();
  storeThemesCache = [];
  storeStatsCache = {};
  resetFilters();
  await loadMarketplace();
}

async function checkForThemeUpdates(): Promise<void> {
  try {
    console.debug("[ThemeStore] Checking for theme updates...");
    const permission = await checkStorePermissions();
    if (!permission.granted) {
      console.debug("[ThemeStore] Skipping update check: permissions not granted");
      return;
    }

    const installed = await getInstalledStoreThemes();
    if (installed.length === 0) {
      console.debug("[ThemeStore] Skipping update check: no themes installed");
      return;
    }

    console.debug(`[ThemeStore] Checking updates for ${installed.length} installed theme(s)`);
    const storeThemes = await fetchAllStoreThemes();
    const updatedIds = await performSilentUpdates(storeThemes);

    if (updatedIds.length > 0) {
      console.debug(`[ThemeStore] Updated ${updatedIds.length} theme(s):`, updatedIds);
      updateYourThemesDropdown();
    }
  } catch (err) {
    console.warn("[ThemeStore] Update check failed:", err);
  }
}

function setupKeyboardListeners(): void {
  document.addEventListener("keydown", e => {
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

async function applyFiltersToGrid(): Promise<void> {
  const grid = document.getElementById("store-modal-grid");
  if (!grid) return;

  const installedThemes = await getInstalledStoreThemes();
  const installedIds = new Set(installedThemes.map(t => t.id));

  const cards = Array.from(grid.querySelectorAll(".store-card")) as HTMLElement[];
  const filteredCards: HTMLElement[] = [];

  cards.forEach(card => {
    const themeId = card.dataset.themeId;
    if (!themeId) return;

    const theme = storeThemesCache.find(t => t.id === themeId);
    if (!theme) return;

    const matchesSearch = matchesSearchQuery(theme, currentFilters.searchQuery);
    const matchesShowFilter = matchesInstallFilter(theme.id, installedIds, currentFilters.showFilter);
    const matchesShaderFilter = !currentFilters.hasShaders || theme.hasShaders;
    const matchesVersionFilter =
      !currentFilters.versionCompatible || isVersionCompatible(theme.minVersion, EXTENSION_VERSION);

    const matchesFilters = matchesSearch && matchesShowFilter && matchesShaderFilter && matchesVersionFilter;

    if (matchesFilters) {
      card.classList.remove("filtered-out");
      filteredCards.push(card);
    } else {
      card.classList.add("filtered-out");
      card.style.display = "none";
    }
  });

  filteredCards.sort((a, b) => {
    const statsA = storeStatsCache[a.dataset.themeId || ""] || { installs: 0, rating: 0, ratingCount: 0 };
    const statsB = storeStatsCache[b.dataset.themeId || ""] || { installs: 0, rating: 0, ratingCount: 0 };

    if (currentFilters.sortBy === "downloads") {
      return statsB.installs - statsA.installs;
    } else if (currentFilters.sortBy === "rating") {
      if (statsB.rating !== statsA.rating) {
        return statsB.rating - statsA.rating;
      }
      return statsB.ratingCount - statsA.ratingCount;
    } else if (currentFilters.sortBy === "newest") {
      const indexA = storeThemesCache.findIndex(t => t.id === a.dataset.themeId);
      const indexB = storeThemesCache.findIndex(t => t.id === b.dataset.themeId);
      return indexB - indexA;
    }
    return 0;
  });

  filteredCards.forEach(card => grid.appendChild(card));

  if (isMarketplacePage && filteredCards.length > ITEMS_PER_PAGE) {
    const totalPages = Math.ceil(filteredCards.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;

    filteredCards.forEach((card, index) => {
      card.style.display = index >= startIndex && index < endIndex ? "" : "none";
    });

    updatePaginationUI(filteredCards.length, totalPages);
  } else {
    filteredCards.forEach(card => {
      card.style.display = "";
    });
    hidePagination();
  }

  const existingEmpty = grid.querySelector(".store-empty");
  if (existingEmpty) existingEmpty.remove();

  if (filteredCards.length === 0 && storeThemesCache.length > 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "store-empty";
    emptyMsg.textContent = "No themes match your filters";
    grid.appendChild(emptyMsg);
    hidePagination();
  }
}

function updatePaginationUI(_totalItems: number, totalPages: number): void {
  const paginationContainer = document.getElementById("marketplace-pagination");
  const numbersContainer = document.getElementById("pagination-numbers");
  const prevBtn = document.getElementById("pagination-prev") as HTMLButtonElement;
  const nextBtn = document.getElementById("pagination-next") as HTMLButtonElement;

  if (!paginationContainer || !numbersContainer) return;

  paginationContainer.style.display = "flex";

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  numbersContainer.replaceChildren();

  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    numbersContainer.appendChild(createPageButton(1));
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.className = "marketplace-pagination-info";
      ellipsis.textContent = "...";
      numbersContainer.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    numbersContainer.appendChild(createPageButton(i));
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.className = "marketplace-pagination-info";
      ellipsis.textContent = "...";
      numbersContainer.appendChild(ellipsis);
    }
    numbersContainer.appendChild(createPageButton(totalPages));
  }
}

function createPageButton(pageNum: number): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = `marketplace-pagination-btn ${pageNum === currentPage ? "active" : ""}`;
  btn.textContent = String(pageNum);
  btn.addEventListener("click", () => {
    currentPage = pageNum;
    applyFiltersToGrid();
    scrollToTop();
  });
  return btn;
}

function hidePagination(): void {
  const paginationContainer = document.getElementById("marketplace-pagination");
  if (paginationContainer) paginationContainer.style.display = "none";
}

function matchesSearchQuery(theme: StoreTheme, query: string): boolean {
  if (!query) return true;

  const searchableText = [theme.title, theme.description, ...theme.creators].join(" ").toLowerCase();

  return searchableText.includes(query);
}

function matchesInstallFilter(themeId: string, installedIds: Set<string>, filter: FilterState["showFilter"]): boolean {
  if (filter === "all") return true;
  const isInstalled = installedIds.has(themeId);
  return filter === "installed" ? isInstalled : !isInstalled;
}

function setupDetailModalListeners(): void {
  const closeBtn = document.getElementById("detail-modal-close");
  closeBtn?.addEventListener("click", closeDetailModal);

  detailModalOverlay?.addEventListener("click", e => {
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

  urlModalOverlay?.addEventListener("click", e => {
    if (e.target === urlModalOverlay) closeUrlModal();
  });

  const cancelBtn = document.getElementById("url-modal-cancel");
  cancelBtn?.addEventListener("click", closeUrlModal);

  const installBtn = document.getElementById("url-modal-install");
  installBtn?.addEventListener("click", handleUrlInstall);

  const input = document.getElementById("url-modal-input") as HTMLInputElement;
  input?.addEventListener("keypress", e => {
    if (e.key === "Enter") handleUrlInstall();
  });
}

function createStoreThemeCard(theme: StoreTheme, isInstalled: boolean, stats?: ThemeStats): HTMLElement {
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
    coverImg.src = "https://placehold.co/400x240/333333/666666?text=No+Preview";
  };

  const content = document.createElement("div");
  content.className = "store-card-content";

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

  actionBtn.addEventListener("click", async e => {
    e.stopPropagation();
    card.dataset.loading = "true";
    try {
      await handleThemeAction(theme, actionBtn);
    } finally {
      delete card.dataset.loading;
    }
  });

  info.appendChild(title);
  info.appendChild(author);

  content.appendChild(info);
  content.appendChild(actionBtn);

  card.appendChild(coverImg);
  card.appendChild(content);

  if (stats && (stats.installs > 0 || stats.ratingCount > 0)) {
    const statsRow = document.createElement("div");
    statsRow.className = "store-card-stats";

    if (stats.installs > 0) {
      const installStat = document.createElement("span");
      installStat.className = "store-card-stat";
      installStat.title = `${stats.installs} installs`;
      installStat.appendChild(createDownloadIcon());
      installStat.appendChild(document.createTextNode(formatNumber(stats.installs)));
      statsRow.appendChild(installStat);
    }

    if (stats.ratingCount > 0) {
      const ratingStat = document.createElement("span");
      ratingStat.className = "store-card-stat";
      ratingStat.title = `${stats.rating.toFixed(1)} average from ${stats.ratingCount} ratings`;
      ratingStat.appendChild(createStarIcon());
      ratingStat.appendChild(document.createTextNode(stats.rating.toFixed(1)));
      statsRow.appendChild(ratingStat);
    }

    card.appendChild(statsRow);
  }

  card.addEventListener("click", () => {
    if (card.dataset.loading) return;
    openDetailModal(theme);
  });

  if (theme.hasShaders) {
    card.appendChild(createShaderBadge("store-card-badge"));
  }

  if (!isCompatible) {
    const incompatBadge = document.createElement("span");
    incompatBadge.className = "store-card-badge-warn";
    incompatBadge.title = `Requires Better Lyrics v${theme.minVersion} or higher`;

    const warnIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    warnIcon.setAttribute("viewBox", "0 0 24 24");
    warnIcon.setAttribute("fill", "currentColor");
    const warnPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    warnPath.setAttribute(
      "d",
      "m21.171 15.398l-5.912-9.854C14.483 4.251 13.296 3.511 12 3.511s-2.483.74-3.259 2.031l-5.912 9.856c-.786 1.309-.872 2.705-.235 3.83C3.23 20.354 4.472 21 6 21h12c1.528 0 2.77-.646 3.406-1.771s.551-2.521-.235-3.831M12 17.549c-.854 0-1.55-.695-1.55-1.549c0-.855.695-1.551 1.55-1.551s1.55.696 1.55 1.551c0 .854-.696 1.549-1.55 1.549m1.633-7.424c-.011.031-1.401 3.468-1.401 3.468c-.038.094-.13.156-.231.156s-.193-.062-.231-.156l-1.391-3.438a1.8 1.8 0 0 1-.129-.655c0-.965.785-1.75 1.75-1.75a1.752 1.752 0 0 1 1.633 2.375"
    );
    warnIcon.appendChild(warnPath);

    incompatBadge.appendChild(warnIcon);
    incompatBadge.appendChild(document.createTextNode(`v${theme.minVersion}+`));
    content.appendChild(incompatBadge);
  }

  return card;
}

async function handleThemeAction(theme: StoreTheme, button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  const isRemoveButton = button.classList.contains("store-card-btn-remove");

  try {
    if (isRemoveButton) {
      await removeTheme(theme.id);
      button.className = "store-card-btn store-card-btn-install";
      button.textContent = "Install";
      showAlert(`Removed ${theme.title}`, theme.title);
    } else {
      await installTheme(theme);
      button.className = "store-card-btn store-card-btn-remove";
      button.textContent = "Remove";
      showAlert(`Installed ${theme.title}`, theme.title);
      if (!userInstallsCache[theme.id]) {
        trackInstall(theme.id)
          .then(result => {
            if (result.success && result.data !== null) {
              markUserInstall(theme.id);
              if (storeStatsCache[theme.id]) {
                storeStatsCache[theme.id].installs = result.data;
              } else {
                storeStatsCache[theme.id] = { installs: result.data, rating: 0, ratingCount: 0 };
              }
            }
          })
          .catch(() => {});
      }
    }

    updateYourThemesDropdown();
  } catch (err) {
    console.error("[ThemeStore] Action failed:", err);
    button.className = `store-card-btn ${isRemoveButton ? "store-card-btn-remove" : "store-card-btn-install"}`;
    button.textContent = isRemoveButton ? "Remove" : "Install";
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
  if (descEl) descEl.replaceChildren(parseMarkdown(theme.description));

  const statsEl = document.getElementById("detail-stats");
  const ratingSectionEl = document.getElementById("detail-rating-section");
  const ratingStarsEl = document.getElementById("detail-rating-stars");
  const ratingStatusEl = document.getElementById("detail-rating-status");

  if (statsEl) {
    statsEl.replaceChildren();
    const themeStats = storeStatsCache[theme.id];
    if (themeStats && (themeStats.installs > 0 || themeStats.ratingCount > 0)) {
      if (themeStats.installs > 0) {
        const installStat = document.createElement("span");
        installStat.className = "detail-stat";
        installStat.title = `${themeStats.installs} downloads`;
        installStat.appendChild(createDownloadIcon());
        installStat.appendChild(document.createTextNode(formatNumber(themeStats.installs)));
        statsEl.appendChild(installStat);
      }
      if (themeStats.ratingCount > 0) {
        const ratingStat = document.createElement("span");
        ratingStat.className = "detail-stat";
        ratingStat.appendChild(createStarIcon());
        ratingStat.appendChild(document.createTextNode(`${themeStats.rating.toFixed(1)} (${themeStats.ratingCount})`));
        statsEl.appendChild(ratingStat);
      }
    }
  }

  if (ratingSectionEl && ratingStarsEl && ratingStatusEl) {
    const starButtons = ratingStarsEl.querySelectorAll(".detail-star");
    const existingUserRating = userRatingsCache[theme.id];

    starButtons.forEach((btn, i) => {
      btn.classList.remove("active", "hover");
      if (existingUserRating && i < existingUserRating) {
        btn.classList.add("active");
      }
    });

    let currentRating = existingUserRating || 0;

    const updateStarDisplay = (rating: number, isHover = false) => {
      starButtons.forEach((btn, i) => {
        btn.classList.toggle("hover", isHover && i < rating);
        btn.classList.toggle("active", !isHover && i < rating);
      });
    };

    if (existingUserRating) {
      ratingStatusEl.textContent = `You rated ${existingUserRating} star${existingUserRating > 1 ? "s" : ""}`;
      ratingStatusEl.className = "detail-rating-status";
    } else {
      ratingStatusEl.textContent = "";
      ratingStatusEl.className = "detail-rating-status";
    }

    ratingStarsEl.onmouseleave = () => {
      updateStarDisplay(currentRating, false);
    };

    starButtons.forEach((btn, index) => {
      const rating = index + 1;

      (btn as HTMLButtonElement).onmouseenter = () => {
        updateStarDisplay(rating, true);
      };

      (btn as HTMLButtonElement).onclick = async () => {
        updateStarDisplay(rating, false);
        currentRating = rating;

        ratingStatusEl.textContent = "Submitting...";
        ratingStatusEl.className = "detail-rating-status";

        const { success, data: ratingData, error } = await submitRating(theme.id, rating);
        if (success && ratingData) {
          await saveUserRating(theme.id, rating);
          ratingStatusEl.textContent = `You rated ${rating} star${rating > 1 ? "s" : ""}`;
          ratingStatusEl.className = "detail-rating-status success";

          if (storeStatsCache[theme.id]) {
            storeStatsCache[theme.id].rating = ratingData.average;
            storeStatsCache[theme.id].ratingCount = ratingData.count;
          } else {
            storeStatsCache[theme.id] = { installs: 0, rating: ratingData.average, ratingCount: ratingData.count };
          }

          if (statsEl) {
            const existingRatingStat = statsEl.querySelector(".detail-stat:nth-child(2)");
            if (existingRatingStat) {
              existingRatingStat.replaceChildren();
              existingRatingStat.appendChild(createStarIcon());
              existingRatingStat.appendChild(
                document.createTextNode(`${ratingData.average.toFixed(1)} (${ratingData.count})`)
              );
            } else {
              const ratingStat = document.createElement("span");
              ratingStat.className = "detail-stat";
              ratingStat.appendChild(createStarIcon());
              ratingStat.appendChild(document.createTextNode(`${ratingData.average.toFixed(1)} (${ratingData.count})`));
              statsEl.appendChild(ratingStat);
            }
          }
        } else {
          ratingStatusEl.textContent = error || "Failed to submit rating";
          ratingStatusEl.className = "detail-rating-status error";
        }
      };
    });
  }

  const initialInstalled = await isThemeInstalled(theme.id);

  const ratingSectionEl2 = document.getElementById("detail-rating-section");
  const ratingStarButtons = ratingSectionEl2?.querySelectorAll(".detail-star") as
    | NodeListOf<HTMLButtonElement>
    | undefined;
  const updateRatingEnabled = (enabled: boolean) => {
    if (ratingSectionEl2) {
      ratingSectionEl2.classList.toggle("disabled", !enabled);
    }
    if (ratingStarButtons) {
      ratingStarButtons.forEach(btn => {
        btn.disabled = !enabled;
      });
    }
  };
  updateRatingEnabled(initialInstalled);

  if (actionBtn) {
    actionBtn.className = `store-card-btn ${initialInstalled ? "store-card-btn-remove" : "store-card-btn-install"}`;
    actionBtn.textContent = initialInstalled ? "Remove" : "Install";
    actionBtn.onclick = async () => {
      actionBtn.disabled = true;
      const isRemoveButton = actionBtn.classList.contains("store-card-btn-remove");
      try {
        if (isRemoveButton) {
          await removeTheme(theme.id);
          actionBtn.className = "store-card-btn store-card-btn-install";
          actionBtn.textContent = "Install";
          showAlert(`Removed ${theme.title}`, theme.title);
          updateRatingEnabled(false);
        } else {
          await installTheme(theme);
          actionBtn.className = "store-card-btn store-card-btn-remove";
          actionBtn.textContent = "Remove";
          showAlert(`Installed ${theme.title}`, theme.title);
          updateRatingEnabled(true);
          if (!userInstallsCache[theme.id]) {
            trackInstall(theme.id)
              .then(result => {
                if (result.success && result.data !== null) {
                  markUserInstall(theme.id);
                  if (storeStatsCache[theme.id]) {
                    storeStatsCache[theme.id].installs = result.data;
                  } else {
                    storeStatsCache[theme.id] = { installs: result.data, rating: 0, ratingCount: 0 };
                  }
                }
              })
              .catch(() => {});
          }
        }
        updateYourThemesDropdown();
        await refreshStoreCards();
      } catch (err) {
        actionBtn.className = `store-card-btn ${isRemoveButton ? "store-card-btn-remove" : "store-card-btn-install"}`;
        actionBtn.textContent = isRemoveButton ? "Remove" : "Install";
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
    shaderDownloadLink.onclick = async e => {
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

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
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
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
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
    nextBtn.classList.toggle("disabled", currentSlideIndex === currentDetailTheme.imageUrls.length - 1);
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

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
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
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
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

  const parsed = parseGitHubRepoUrl(url);
  if (!parsed) {
    if (error) {
      error.textContent = "Invalid GitHub URL. Use format: github.com/user/repo or github.com/user/repo/tree/branch";
      error.style.display = "block";
    }
    return;
  }

  const { repo, branch } = parsed;

  installBtn.disabled = true;
  installBtn.textContent = "Validating...";
  if (error) error.style.display = "none";

  try {
    const permission = await checkStorePermissions();
    if (!permission.granted) {
      const granted = await requestStorePermissions();
      if (!granted) {
        throw new Error("GitHub access required");
      }
    }

    const validation = await validateThemeRepo(repo, branch);
    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }

    installBtn.textContent = "Installing...";

    const theme = await fetchFullTheme(repo, branch);
    await installTheme(theme);
    if (!userInstallsCache[theme.id]) {
      trackInstall(theme.id)
        .then(result => {
          if (result.success) {
            markUserInstall(theme.id);
          }
        })
        .catch(() => {});
    }

    const branchInfo = branch ? ` (${branch})` : "";
    showAlert(`Installed ${theme.title} from ${repo}${branchInfo}`, theme.title);
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
    applyBtn.addEventListener("click", async e => {
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

    showAlert(`Applied ${theme.title}`, theme.title);
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

function resetFilters(): void {
  currentFilters = {
    searchQuery: "",
    sortBy: "rating",
    showFilter: "all",
    hasShaders: false,
    versionCompatible: true,
  };

  const searchInput = document.getElementById("store-search-input") as HTMLInputElement;
  if (searchInput) searchInput.value = "";

  const defaultSortRadio = document.querySelector(
    'input[name="store-filter-sort"][value="default"]'
  ) as HTMLInputElement;
  if (defaultSortRadio) defaultSortRadio.checked = true;

  const allRadio = document.querySelector('input[name="store-filter-show"][value="all"]') as HTMLInputElement;
  if (allRadio) allRadio.checked = true;

  const shaderCheckbox = document.getElementById("store-filter-shaders") as HTMLInputElement;
  if (shaderCheckbox) shaderCheckbox.checked = false;

  const compatibleCheckbox = document.getElementById("store-filter-compatible") as HTMLInputElement;
  if (compatibleCheckbox) compatibleCheckbox.checked = true;
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
  btn?.addEventListener("click", e => {
    e.stopPropagation();
    toggleYourThemesDropdown();
  });

  document.addEventListener("click", e => {
    const dropdown = document.getElementById("your-themes-dropdown");
    const btn = document.getElementById("your-themes-btn");
    if (dropdown && btn && !dropdown.contains(e.target as Node) && !btn.contains(e.target as Node)) {
      toggleYourThemesDropdown(false);
    }
  });
}
