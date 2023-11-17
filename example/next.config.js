const { withNextcast } = require("nextcast");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
};

module.exports = withNextcast(nextConfig);
