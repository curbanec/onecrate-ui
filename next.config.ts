import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Emits a minimal self-contained server bundle for the Docker image. Without
   * this the image has to carry all of node_modules.
   */
  output: "standalone",

  /**
   * Kysely's MssqlDialect reaches for `tedious` and `tarn` at runtime. Both are
   * CommonJS with dynamic requires that the bundler cannot statically trace, so
   * they are left external and resolved from node_modules at runtime.
   */
  serverExternalPackages: ["tedious", "tarn", "kysely"],
};

export default nextConfig;
