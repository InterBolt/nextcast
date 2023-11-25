import { resolve } from "path";

const compilerHookRewrite = (
  pluginName: any,
  rewrites: Record<string, string>,
  compiler: any
) => {
  compiler.hooks.compilation.tap(pluginName, (compilation: any) => {
    compiler.webpack.NormalModule.getCompilationHooks(compilation).loader.tap(
      pluginName,
      (_: any, normalModule: any) => {
        const userRequest = normalModule.userRequest || "";

        const startIndex =
          userRequest.lastIndexOf("!") === -1
            ? 0
            : userRequest.lastIndexOf("!") + 1;

        const moduleRequest = userRequest
          .substring(startIndex)
          .replace(/\\/g, "/");

        const source = rewrites[moduleRequest];
        if (typeof source === "undefined") {
          return;
        }

        if (source === "") {
          throw new Error(
            `${pluginName}: rewrites[${moduleRequest}] cannot be empty`
          );
        }

        normalModule.loaders.push({
          loader: resolve(__dirname, "./loaderRewrite.js"),
          options: { source },
        });
      }
    );
  });
};

export default compilerHookRewrite;
