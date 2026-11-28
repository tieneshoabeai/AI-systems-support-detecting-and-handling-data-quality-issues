interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_PREFIX?: string
  readonly VITE_API_ENVIRONMENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
