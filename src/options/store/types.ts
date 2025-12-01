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
  description: string;
  creators: string[];
  minVersion: string;
  hasShaders: boolean;
  tags?: string[];
  version: string;
  images?: string[];
}

export interface StoreTheme extends StoreThemeMetadata {
  repo: string;
  coverUrl: string;
  imageUrls: string[];
  cssUrl: string;
  shaderUrl?: string;
}

export interface InstalledStoreTheme {
  id: string;
  repo: string;
  title: string;
  creators: string[];
  css: string;
  shaderConfig?: Record<string, unknown>;
  installedAt: number;
  version: string;
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
