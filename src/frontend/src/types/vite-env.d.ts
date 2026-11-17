interface ImportMetaEnv {
  readonly VITE_MANAGEMENT_DATA_MODE?: 'mock' | 'api'
  readonly VITE_SWAGGER_URL?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_PREFIX?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
