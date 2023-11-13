import type * as Classes from "./index";
import * as Utils from "../utils/index";
import type * as Types from "../types";
import { basename, resolve, dirname } from "path";
import { existsSync, writeFileSync } from "fs";
import { glob } from "glob";
import type { Collection } from "jscodeshift";

export interface ICollectionItem {
  payload: Types.JSONValue;
  timestamp: number;
}

class App {
  private cache: Classes.cache;
  private traversals: Classes.traversals;

  constructor(
    cache: Classes.cache,
    { _unstable_traversals }: { _unstable_traversals: Classes.traversals }
  ) {
    this.traversals = _unstable_traversals;
    this.cache = cache;
  }

  private overwriteProtection = (path: string) => {
    if (!path.startsWith(Utils.nextjs.getProjectRoot())) {
      throw new Error(
        `Cannot overwrite ${path} because it is not in the project root.`
      );
    }
  };

  private getRouteRewritesPath = (routeName: string) => {
    return ["route_rewrites", routeName] as const;
  };

  private getCommittingRewritesPath = () => {
    return ["committing_rewrites"] as const;
  };

  private getRouteCollectionPath = (routeName: string) => {
    return ["route_collections", routeName] as const;
  };

  private getRoutePath = (routeName?: string) => {
    if (typeof routeName === "string") {
      return ["routes", routeName] as const;
    }
    return ["routes"] as const;
  };

  private getRouteTypeCollectionPath = () => {
    return ["route_type_collection"] as const;
  };

  public createRewriter = (routeName: string, fallbackFilePath: string) => {
    if (!existsSync(fallbackFilePath)) {
      throw new Error(
        `Cannot rewrite ${fallbackFilePath} because it does not exist.`
      );
    }

    return async (
      codeOrCollection: string | Collection<any>,
      filePath: string = fallbackFilePath
    ) => {
      const code =
        typeof codeOrCollection === "string"
          ? codeOrCollection
          : codeOrCollection.toSource();

      this.cache.merge<string>(this.getCommittingRewritesPath(), {
        [filePath]: code,
      });

      this.cache.push(this.getRouteRewritesPath(routeName), {
        filePath,
        code,
      });
    };
  };

  public collect = (data: Types.JSONValue) => {
    try {
      JSON.stringify(data);
    } catch (err) {
      throw new Error(
        `Cannot collect data because it is not JSON serializable.`
      );
    }

    const cachePath = this.getRouteTypeCollectionPath();
    const dataset = this.cache.get<Array<ICollectionItem>>(cachePath);

    if (!Array.isArray(dataset)) {
      throw new Error(`Cannot push data to route because it is not an array.`);
    }

    dataset.push({
      payload: data,
      timestamp: Date.now(),
    });
  };

  public getCollection = () =>
    this.cache.get<Array<ICollectionItem>>(this.getRouteTypeCollectionPath()) ||
    [];

  public getRoutes = (
    providedNames?: Array<string> | string
  ): Array<Types.Segment> => {
    return this.getRouteNames(providedNames).map((name) =>
      this.cache.get<Types.Segment>(this.getRoutePath(name))
    );
  };

  public getRouteNames = (
    providedNames?: Array<string> | string
  ): Array<string> => {
    let usedFromCache = false;
    let names =
      typeof providedNames === "string" ? [providedNames] : providedNames || [];

    if (!names.length) {
      names = Object.keys(this.cache.get(this.getRoutePath()));
      usedFromCache = true;
    } else {
      const existingName = Object.values(this.cache.get(this.getRoutePath()));
      const nonexistentNames = names.filter((name) => {
        return !existingName.includes(name);
      });

      if (nonexistentNames.length) {
        throw new Error(
          `Cannot get routes ${nonexistentNames.join(
            ", "
          )} because they do not exist in cache yet.`
        );
      }
    }

    return usedFromCache ? names.sort() : names;
  };

  public stashCollection = (dataDir: string) => {
    if (!existsSync(dataDir)) {
      throw new Error(
        `Cannot commit collection because ${dataDir} does not exist.`
      );
    }

    const cachePath = this.getRouteTypeCollectionPath();
    const collection = this.cache.get<Array<ICollectionItem>>(cachePath) || [];

    this.overwriteProtection(dataDir);
    writeFileSync(
      resolve(dataDir, `collection.json`),
      JSON.stringify(collection, null, 2)
    );
  };

  public stashReducedCollection = (
    dataDir: string,
    reduced: Types.JSONValue
  ) => {
    if (!existsSync(dataDir)) {
      throw new Error(
        `Cannot commit reduced collection because ${dataDir} does not exist.`
      );
    }

    this.overwriteProtection(dataDir);
    writeFileSync(
      resolve(dataDir, `data.json`),
      JSON.stringify(reduced, null, 2)
    );
  };

  public stashErrors = (dataDir: string, errors: Types.JSONValue) => {
    if (!existsSync(dataDir)) {
      throw new Error(
        `Cannot commit errors because ${dataDir} does not exist.`
      );
    }

    this.overwriteProtection(dataDir);
    writeFileSync(
      resolve(dataDir, `errors.json`),
      JSON.stringify(errors, null, 2)
    );
  };

  public getRewrites = () => {
    const cachePath = this.getCommittingRewritesPath();
    return this.cache.get<Record<string, string>>(cachePath);
  };

  public stashRewrites = (dataDir: string) => {
    if (!existsSync(dataDir)) {
      throw new Error(
        `Cannot commit rewrites because ${dataDir} does not exist.`
      );
    }
    const cachePath = this.getCommittingRewritesPath();
    const rewriteMap = this.cache.get<Record<string, string>>(cachePath);

    this.overwriteProtection(dataDir);
    writeFileSync(
      resolve(dataDir, `rewrites.json`),
      JSON.stringify(rewriteMap, null, 2)
    );
  };

  public executeRewrites = (dataDir: string) => {
    if (!existsSync(dataDir)) {
      throw new Error(
        `Cannot commit rewrites because ${dataDir} does not exist.`
      );
    }
    const cachePath = this.getCommittingRewritesPath();
    const rewriteMap = this.cache.get<Record<string, string>>(cachePath);

    Object.entries(rewriteMap).forEach(([filePath, code]) => {
      this.overwriteProtection(filePath);
      writeFileSync(filePath, code);
    });
  };

  public load = async () => {
    const appDir = Utils.nextjs.getAppDir();

    const pageRoutes = (await glob(`${appDir}/**/page.{js,ts,jsx,tsx}`)).map(
      (pageFile) => ({
        name: Utils.nextjs.removeExt(pageFile).replace(appDir, "") || "/page",
        entries: [
          "page",
          "template",
          "loading",
          ...Utils.nextjs.getParentLayouts(pageFile),
        ]
          .map((entryFile) =>
            Utils.nextjs.withCorrectExt(
              resolve(dirname(pageFile), `${entryFile}.js`),
              null
            )
          )
          .filter((e) => e),
        files: [],
      })
    );

    const notFoundRoutes = (
      await glob(`${appDir}/**/not-found.{js,ts,jsx,tsx}`)
    ).map((notFoundFile) => ({
      name:
        Utils.nextjs.removeExt(notFoundFile).replace(appDir, "") ||
        "/not-found",
      entries: [notFoundFile],
      files: [],
    }));

    const errorRoutes = (
      await glob(`${appDir}/**/{error,global-error}.{js,ts,jsx,tsx}`)
    )
      .map(Utils.nextjs.removeExt)
      .filter((errorFileWithoutExt, _i, filesWithoutExt) => {
        const hasGlobalError =
          filesWithoutExt.indexOf(resolve(appDir, "global-error")) !== -1;
        const isRootErrorFile =
          errorFileWithoutExt === resolve(appDir, "error");
        const shouldRemove = hasGlobalError && isRootErrorFile;

        return !shouldRemove;
      })
      .map(Utils.nextjs.withCorrectExt)
      .map((errorFile) => ({
        name: Utils.nextjs.removeExt(errorFile).replace(appDir, "") || "/error",
        entries:
          Utils.nextjs.removeExt(basename(errorFile)) === "global-error"
            ? [errorFile]
            : [errorFile, ...Utils.nextjs.getParentLayouts(errorFile)],
        files: [],
      }));

    this.cache.register(this.getCommittingRewritesPath(), {});
    this.cache.register(this.getRouteTypeCollectionPath(), []);
    [...pageRoutes, ...notFoundRoutes, ...errorRoutes].forEach((route) => {
      const routePath = this.getRoutePath(route.name);
      this.cache.register(this.getRouteRewritesPath(route.name), []);
      this.cache.register(this.getRouteCollectionPath(route.name), []);
      this.cache.register(routePath, {
        ...route,
        files: route.entries
          .map((entry) => this.traversals.walkImports(entry))
          .flat()
          .reduce(
            (unique, filePath) =>
              unique.includes(filePath) ? unique : unique.concat([filePath]),
            [] as Array<string>
          ),
      });
    });
  };
}

export default App;
