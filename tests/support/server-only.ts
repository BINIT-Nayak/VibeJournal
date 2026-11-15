// Vitest executes server modules outside Next's bundler. This test-only alias
// removes its import guard; application builds retain the real server-only guard.
export {};
