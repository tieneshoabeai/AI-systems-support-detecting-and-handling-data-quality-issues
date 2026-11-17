import { defineConfig, mergeConfig } from 'vite'
import appConfig from './vite.config.ts'

// Shopping Demo requires DEV. Keep the application plugins, but do not load local env files.
export default mergeConfig(appConfig, defineConfig({ envDir: false }))
