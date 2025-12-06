export interface ThemeStoreIndex {
  version: number;
  themes: ThemeRepoReference[];
}

export interface ThemeRepoReference {
  repo: string;
}

export interface StoreThemeMetadata {
  id: string;
  title: string;
  description?: string;
  creators: string[];
  minVersion: string;
  hasShaders: boolean;
  tags?: string[];
  version: string;
  images?: string[];
}

export interface ResolvedStoreThemeMetadata extends Omit<StoreThemeMetadata, "description"> {
  description: string;
}

export interface StoreTheme extends ResolvedStoreThemeMetadata {
  repo: string;
  coverUrl: string;
  imageUrls: string[];
  cssUrl: string;
  shaderUrl?: string;
}

export type ThemeSource = "marketplace" | "url";

export interface InstalledStoreTheme {
  id: string;
  repo: string;
  title: string;
  creators: string[];
  css: string;
  shaderConfig?: Record<string, unknown>;
  installedAt: number;
  version: string;
  source?: ThemeSource;
  sourceUrl?: string;
  branch?: string;
  description?: string;
  coverUrl?: string;
  imageUrls?: string[];
  minVersion?: string;
  hasShaders?: boolean;
  tags?: string[];
}

export interface ThemeValidationResult {
  valid: boolean;
  errors: string[];
  missingFiles: string[];
}

export interface PermissionStatus {
  granted: boolean;
  canRequest: boolean;
}

export interface ThemeStats {
  installs: number;
  rating: number;
  ratingCount: number;
}

export type AllThemeStats = Record<string, ThemeStats>;

export interface RatingResult {
  average: number;
  count: number;
}

export interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}
