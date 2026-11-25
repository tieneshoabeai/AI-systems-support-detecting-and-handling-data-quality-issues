import { test as base } from '@playwright/test'
import { closeSession, login } from './live-api'
import type { LiveSession } from './live-api'

type LiveFixture = {
  session: LiveSession
  deferCleanup: (operation: () => Promise<void>) => void
}

// Dependent teardown runs before page disposal, even when the test body times out.
export const test = base.extend<{ live: LiveFixture }>({
  live: [async ({ page }, provide) => {
    const session = await login(page)
    const operations: (() => Promise<void>)[] = []
    const teardown = async () => {
      const errors: unknown[] = []
      // Stop background UI reads before deleting their fixture resources.
      try {
        await page.context().setOffline(false)
        await page.goto('about:blank')
      } catch { /* Cleanup uses an independent Node transport. */ }
      for (const operation of operations) {
        try { await operation() } catch (error) { errors.push(error) }
      }
      try { await closeSession(page, session) } catch (error) { errors.push(error) }
      if (errors.length) throw new AggregateError(errors, 'Live E2E teardown failed; inspect owned test resources.')
    }
    try {
      await provide({ session, deferCleanup: operation => { operations.push(operation) } })
    } finally { await teardown() }
  }, { timeout: 90_000 }],
})
