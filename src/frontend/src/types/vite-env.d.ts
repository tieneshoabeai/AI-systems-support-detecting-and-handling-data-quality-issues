interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_PREFIX?: string
  readonly VITE_API_ENVIRONMENT_ID?: string
  readonly VITE_API_MIGRATE_FROM?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
