import * as Utils from "../utils";
import type * as Types from "../types";
import macropack from "..";

export async function loader(routeLayoutSource: string) {
  const callback = this.async();
  const options = this.getOptions() as Types.MacroOptions;

  try {
    const { data } = await macropack(options);

    const sourceWithDataAttribute = Utils.addDataAttributeToJSX(
      routeLayoutSource,
      `data-macropack-${options.name}`,
      data,
      "html"
    );

    return callback(null, sourceWithDataAttribute);
  } catch (err) {
    callback(err, routeLayoutSource);
  }
}

const withMacropack = (options: Types.MacroOptions) => (nextConfig: any) => {
  const webpack = (config: any, nextWebpackOptions: any) => {
    config.module.rules.push({
      // Run on the root layout because we'll attach the lookahead data
      // to the body tag as a data attribute.
      test: new RegExp(`${Utils.nextjs.getAppDir()}/layout.(js|ts|tsx|jsx)`),
      use: [
        {
          options,
          loader: "./macropack/dist/next/loader.js",
        },
      ],
    });
    if (typeof nextConfig.webpack === "function") {
      return nextConfig.webpack(config, nextWebpackOptions);
    }
    return config;
  };
  return Object.assign({}, nextConfig, { webpack });
};

export default withMacropack;
