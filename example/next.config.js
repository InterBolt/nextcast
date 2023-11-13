const { withMacropack, macros } = require("@interbolt/macropack");
const path = require("path");

/** @type {import('@interbolt/macropack').macros.HookCalls.Config} */
const hookCallsMacroConfig = {
  path: path.resolve(__dirname, "src", "code", "useCloudflareData.ts"),
  exportIdentifier: "default",
  allowedArgTypes: ["StringLiteral"],
};

/** @type {import('@interbolt/macropack').WithMacropackOptions} */
const hookCallsMacro = {
  macro: macros.HookCalls,
  macroConfig: hookCallsMacroConfig,
  name: "useCloudflareData",
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
};

module.exports = withMacropack([hookCallsMacro])(nextConfig);
