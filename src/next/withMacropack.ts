import * as Utils from "../utils";
import type * as Types from "../types";
import { macropackNextjs, buildOptions } from "../macropack";
import { resolve } from "path";
import jscodeshift from "jscodeshift";
import * as Classes from "../classes";

export async function attachDataLoader(code: string) {
  const callback = this.async();
  const options = buildOptions(this.getOptions() as Types.MacroOptions);
  const pathToData = resolve(options.dataDir, `data.json`);
  const data = require(pathToData);
  const codemods = new Classes.codemods(jscodeshift.withParser("tsx")(code));

  codemods.addDataToHTMLTag(data, `data-macropack-${options.name}`, "html");

  try {
    return callback(null, codemods.collection.toSource());
  } catch (err) {
    callback(err, code);
  }
}

export async function rewriterLoader(code: string) {
  const callback = this.async();
  const options = buildOptions(this.getOptions() as Types.MacroOptions);
  const resourcePath = this.resourcePath as string;
  const pathToRewrites = resolve(options.dataDir, `rewrites.json`);
  const rewrite = (() => {
    try {
      return require(pathToRewrites);
    } catch (err) {
      console.log(err);
      throw new Error(`Could not require ${pathToRewrites}`);
    }
  })()[resourcePath];

  try {
    return callback(null, typeof rewrite === "string" ? rewrite : code);
  } catch (err) {
    callback(err, code);
  }
}

class MacropackPlugin {
  public options: Types.MacroOptions;
  constructor(options: Types.MacroOptions) {
    this.options = options;
  }

  apply(compiler: any) {
    compiler.hooks.compilation.tap("Macropack", async () => {
      // Macropack won't do rewrites in this phase, so we can do
      // them in webpack loaders that don't modify our source code.
      await macropackNextjs({
        ...this.options,
        rewrite: false,
      });
    });
  }
}

const withMacropack =
  (macroOptions: Array<Types.MacroOptions>) => (nextConfig: any) => {
    macroOptions.reduce((acc, option) => {
      if (acc.includes(option.name)) {
        throw new Error(
          `Macropack: Duplicate option name ${option.name}. Please use unique names.`
        );
      }
      return [...acc, option.name];
    }, []);

    const webpack = (config: any, nextWebpackOptions: any) => {
      macroOptions.forEach((options) => {
        config.plugins.push(new MacropackPlugin(options));
        config.module.rules.push(
          {
            // Run on the root layout because we'll attach the lookahead data
            // to the body tag as a data attribute.
            test: new RegExp(
              `${Utils.nextjs.getAppDir()}/layout.(js|ts|tsx|jsx)`
            ),
            use: [
              {
                options,
                loader: resolve(__dirname, "attachDataLoader.js"),
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
                options,
                loader: resolve(__dirname, "rewriteLoader.js"),
              },
            ],
            // we must run this before attaching data to the root layout
            // in the loader below so that we don't lose our data attribute
            // in the process of executing rewrites.
            enforce: "pre",
          }
        );
      });

      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, nextWebpackOptions);
      }
      return config;
    };
    return Object.assign({}, nextConfig, { webpack });
  };

export default withMacropack;
