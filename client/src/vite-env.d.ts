/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WINDY_MAP_FORECAST_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
