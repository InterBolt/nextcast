import { resolve } from "path";
import constants from "./constants";
import RunnerPlugin from "./webpack/plugin/Runner";
import * as Types from "./types";
import nextSpec from "./next/nextSpec";
import { existsSync } from "fs";

export const withNextCast = (
  nextConfig: Record<string, any>,
  opts?: Types.WithNextCastOptions
) => {
  const { plugins = [] } = opts || {};
  const getPlugins = (
    userPlugins: Array<Types.Plugin<any>>
  ): Array<Types.Plugin<any>> => {
    return (
      typeof plugins === "function"
        ? plugins(userPlugins)
        : plugins.concat(userPlugins)
    )
      .flat()
      .map((plugin) => {
        if (typeof plugin !== "string") {
          return plugin;
        }
        const nodeModulesPathToPlugin = resolve(
          nextSpec.getProjectRoot(),
          "node_modules",
          plugin,
          "dist"
        );
        const relativePathToPlugin = resolve(
          nextSpec.getProjectRoot(),
          plugin,
          "dist"
        );
        if (existsSync(nodeModulesPathToPlugin)) {
          return require(nodeModulesPathToPlugin);
        }
        if (existsSync(relativePathToPlugin)) {
          return require(relativePathToPlugin);
        }
        throw new Error(
          `${constants.name} error: could not resolve plugin path: ${plugin}`
        );
      });
  };

  const webpack = (config: any, nextWebpackOptions: any) => {
    config.plugins.push(
      new RunnerPlugin({ inputDir: constants.userDir, getPlugins })
    );

    config.module.rules.push({
      // Run on the root layout because we'll attach the lookahead data
      // to the body tag as a data attribute.
      test: /\.(js|jsx|ts|tsx)$/,
      use: [
        {
          loader: resolve(__dirname, "webpack/loaders/rewrite.js"),
        },
      ],
      // we must run this before attaching data to the root layout
      // in the loader below so that we don't lose our data attribute
      // in the process of executing rewrites.
      enforce: "pre",
    });

    if (typeof nextConfig.webpack === "function") {
      return nextConfig.webpack(config, nextWebpackOptions);
    }
    return config;
  };
  return Object.assign({}, nextConfig, { webpack });
};
