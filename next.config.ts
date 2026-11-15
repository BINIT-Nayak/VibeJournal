import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER } from "next/constants";
import { parseServerEnv } from "./src/server/env/schema";

const nextConfig = (phase: string): NextConfig => {
  // Next 15 may log a rejected instrumentation hook without exiting next start.
  // Validate here too so CLI startup fails before binding/announcing readiness.
  // Builds deliberately do not require deployment secrets.
  if (phase === PHASE_DEVELOPMENT_SERVER || phase === PHASE_PRODUCTION_SERVER) {
    parseServerEnv(process.env);
  }
  return {
    // Keep production builds from overwriting a running dev server's artifacts.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
};

export default nextConfig;
