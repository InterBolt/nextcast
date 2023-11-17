import { resolve } from "path";
import constants from "./constants";
import * as Utils from "./utils";
import RunnerPlugin from "./webpack/plugin/Runner";

export const withNextcast = (nextConfig: any, opts?: { inputDir?: string }) => {
  const { inputDir = constants.userDir } = opts || {};

  const webpack = (config: any, nextWebpackOptions: any) => {
    config.plugins.push(new RunnerPlugin({ inputDir }));

    config.module.rules.push(
      {
        // Run on the root layout because we'll attach the lookahead data
        // to the body tag as a data attribute.
        test: new RegExp(`${Utils.getAppDir()}/layout.(js|ts|tsx|jsx)`),
        use: [
          {
            loader: resolve(__dirname, "webpack/loaders/attachData.import.js"),
          },
        ],
        enforce: "pre",
      },
      {
        // Run on the root layout because we'll attach the lookahead data
        // to the body tag as a data attribute.
        test: /\.(js|jsx|ts|tsx)$/,
        use: [
          {
            loader: resolve(__dirname, "webpack/loaders/rewrite.import.js"),
          },
        ],
        // we must run this before attaching data to the root layout
        // in the loader below so that we don't lose our data attribute
        // in the process of executing rewrites.
        enforce: "pre",
      }
    );

    if (typeof nextConfig.webpack === "function") {
      return nextConfig.webpack(config, nextWebpackOptions);
    }
    return config;
  };
  return Object.assign({}, nextConfig, { webpack });
};
