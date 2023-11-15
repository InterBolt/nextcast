const { withMicropack } = require("@interbolt/micropack");
const HookCalls = require("./micropacks/dist/HookCalls/index.js").default;

const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
};

module.exports = withMicropack([
  {
    micro: new HookCalls(
      {
        path: path.resolve(__dirname, "src", "code", "useCloudflareData.ts"),
        exportIdentifier: "default",
        allowedArgTypes: ["StringLiteral"],
      },
      "useCloudflareData"
    ),
  },
])(nextConfig);
