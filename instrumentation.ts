export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate required env vars on Node.js runtime startup. Hard-fails in
    // production if anything required is missing. See src/lib/startup-checks.ts.
    const { assertRequiredEnvVars } = await import('./src/lib/startup-checks')
    assertRequiredEnvVars()

    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
