export async function register() {
  // Sentry temporarily disabled to isolate 500 error
  // if (process.env.NEXT_RUNTIME === 'nodejs') {
  //   await import('./sentry.server.config')
  // }
  // if (process.env.NEXT_RUNTIME === 'edge') {
  //   await import('./sentry.edge.config')
  // }
}
