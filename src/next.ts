import { resolve } from "path";
import constants from "@src/constants";
import NextCastWebpackPlugin from "@src/webpack/plugin";
import * as Types from "@src/types";
import nextSpec from "@src/next/nextSpec";
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
      new NextCastWebpackPlugin({ inputDir: constants.userDir, getPlugins })
    );

    if (typeof nextConfig.webpack === "function") {
      return nextConfig.webpack(config, nextWebpackOptions);
    }
    return config;
  };
  return Object.assign({}, nextConfig, { webpack });
};
