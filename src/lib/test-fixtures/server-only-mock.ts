// Vitest mock for the 'server-only' package.
// In production (Next.js), 'server-only' throws if imported from a Client Component.
// In the test environment (Node/vitest), we just export nothing — the guard is not needed.
export {};
