const { withMicropack } = require("@interbolt/micropack");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
};

module.exports = withMicropack(nextConfig);
