const isDev = import.meta.env.DEV

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log('[Demo Office]', ...args)
    }
  },
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error('[Demo Office]', ...args)
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn('[Demo Office]', ...args)
    }
  }
}
