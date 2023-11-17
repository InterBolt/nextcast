import { basename, resolve, dirname } from "path";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { glob } from "glob";
import type { Collection } from "jscodeshift";
import type STraversals from "./STraversals";
import type { IErrorOrWarning } from "./SErrors";
import Store from "./Store/index";
import * as Utils from "../utils";
import constants from "../constants";
import { JSONValue, Route } from "../types";
import { uniq } from "lodash";

class SApp {
  private store: Store;
  private traversals: STraversals;

  constructor(store: Store, traversals: STraversals) {
    this.traversals = traversals;
    this.store = store;
  }

  private overwriteProtection = (path: string) => {
    if (!path.startsWith(Utils.getProjectRoot())) {
      throw new Error(
        `Cannot overwrite ${path} because it is not in the project root.`
      );
    }
  };

  private _pathRouteRewriteHistory = (routeName: string) =>
    ["rewrite_history", routeName] as const;

  private _pathRewritesToCommit = () => ["rewrites_to_commit"] as const;

  private _pathRouteCollection = (routeName: string) =>
    ["route_collections", routeName] as const;

  private _pathAllRoutes = (routeName?: string) => {
    if (typeof routeName === "string") {
      return ["routes", routeName] as const;
    }
    return ["routes"] as const;
  };

  private _pathRoute = (routeName: string) => ["routes", routeName] as const;

  private _pathAppCollection = () => {
    return ["route_type_collection"] as const;
  };

  private _mapToComponentTypes = (
    files: Array<string>
  ): { clientComponents: Array<string>; serverComponents: Array<string> } => {
    return files
      .map((filePath) => {
        const fileContents = readFileSync(filePath, "utf8");
        const lines = fileContents.split("\n");
        return lines.some(
          (line) =>
            line.trim() === `"use client"` ||
            line.trim() === `"use client";` ||
            line.trim() === `'use client'` ||
            line.trim() === `'use client';`
        );
      })
      .reduce(
        (accum, hasClientDirective, i) => {
          if (hasClientDirective) accum.clientComponents.push(files[i]);
          else accum.serverComponents.push(files[i]);
          return accum;
        },
        {
          clientComponents: [],
          serverComponents: [],
        }
      );
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

      this.store.writes.merge<string>(this._pathRewritesToCommit(), {
        [filePath]: code,
      });

      this.store.writes.push(this._pathRouteRewriteHistory(routeName), {
        filePath,
        code,
      });
    };
  };

  public collect = (data: JSONValue) => {
    try {
      JSON.stringify(data);
    } catch (err) {
      throw new Error(
        `Cannot collect data because it is not JSON serializable.`
      );
    }

    const cachePath = this._pathAppCollection();
    const dataset = this.store.reads.get<Array<JSONValue>>(cachePath);

    if (!Array.isArray(dataset)) {
      throw new Error(`Cannot push data to route because it is not an array.`);
    }

    dataset.push(data);
  };

  public getCollection = () =>
    JSON.parse(
      JSON.stringify(
        this.store.reads.get<Array<JSONValue>>(this._pathAppCollection()) || []
      )
    );

  public getSourceFiles = () => {
    const routes = this.getRoutes();
    return uniq(routes.map((route) => route.files).flat());
  };

  public getRoutes = (providedNames?: Array<string> | string): Array<Route> => {
    return this.getRouteNames(providedNames).map((name) =>
      this.store.reads.get<Route>(this._pathRoute(name))
    );
  };

  public getServerComponents = (providedNames?: Array<string> | string) => {
    const routes = this.getRoutes(providedNames);
    return uniq(routes.map((route) => route.serverComponents).flat());
  };

  public getClientComponents = (providedNames?: Array<string> | string) => {
    const routes = this.getRoutes(providedNames);
    return uniq(routes.map((route) => route.clientComponents).flat());
  };

  public getRouteNames = (
    providedNames?: Array<string> | string
  ): Array<string> => {
    let usedFromCache = false;
    let names =
      typeof providedNames === "string" ? [providedNames] : providedNames || [];

    if (!names.length) {
      names = Object.keys(this.store.reads.get(this._pathAllRoutes()));
      usedFromCache = true;
    } else {
      const existingName = Object.values(
        this.store.reads.get(this._pathAllRoutes())
      );
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

    const cachePath = this._pathAppCollection();
    const collection = this.store.reads.get<Array<JSONValue>>(cachePath) || [];

    this.overwriteProtection(dataDir);
    writeFileSync(
      resolve(dataDir, constants.collectionFileName),
      JSON.stringify(collection, null, 2)
    );
  };

  public stashReducedCollection = (dataDir: string, reduced: JSONValue) => {
    if (!existsSync(dataDir)) {
      throw new Error(
        `Cannot commit reduced collection because ${dataDir} does not exist.`
      );
    }

    this.overwriteProtection(dataDir);
    writeFileSync(
      resolve(dataDir, constants.dataFileName),
      JSON.stringify(reduced, null, 2)
    );
  };

  private stashErrorsOrWarnings = (
    dataDir: string,
    errorsOrWarnings: Array<IErrorOrWarning>,
    level: "warning" | "error"
  ) => {
    if (!existsSync(dataDir)) {
      throw new Error(
        `Cannot commit ${level}s because ${dataDir} does not exist.`
      );
    }

    this.overwriteProtection(dataDir);
    const dataPath = resolve(
      dataDir,
      level === "warning"
        ? constants.warningsFileName
        : constants.errorsFileName
    );

    writeFileSync(dataPath, JSON.stringify(errorsOrWarnings, null, 2));
  };

  public stashErrors = (dataDir: string, errors: Array<IErrorOrWarning>) =>
    this.stashErrorsOrWarnings(dataDir, errors, "error");

  public stashWarnings = (dataDir: string, warnings: Array<IErrorOrWarning>) =>
    this.stashErrorsOrWarnings(dataDir, warnings, "warning");

  public getRewrites = () => {
    const cachePath = this._pathRewritesToCommit();
    return this.store.reads.get<Record<string, string>>(cachePath);
  };

  public stashRewrites = (dataDir: string) => {
    if (!existsSync(dataDir)) {
      throw new Error(
        `Cannot commit rewrites because ${dataDir} does not exist.`
      );
    }

    const cachePath = this._pathRewritesToCommit();
    const rewriteMap = this.store.reads.get<Record<string, string>>(cachePath);

    this.overwriteProtection(dataDir);
    writeFileSync(
      resolve(dataDir, constants.rewritesFileName),
      JSON.stringify(rewriteMap, null, 2)
    );
  };

  public getStashed = (dataDir: string) => {
    if (!existsSync(dataDir)) {
      throw new Error(`Committed data folder ${dataDir} does not exist.`);
    }

    return readdirSync(dataDir)
      .filter((name) => name.endsWith(".json"))
      .reduce((accum, fileName) => {
        try {
          const filePath = resolve(dataDir, fileName);
          const file = JSON.parse(readFileSync(filePath, "utf8"));
          return {
            ...accum,
            [fileName]: file,
          };
        } catch (err) {
          throw new Error(`Failed to parse ${fileName} in ${dataDir}.`);
        }
      }, {} as Record<string, JSONValue>);
  };

  public executeRewrites = (dataDir: string) => {
    if (!existsSync(dataDir)) {
      throw new Error(
        `Cannot commit rewrites because ${dataDir} does not exist.`
      );
    }
    const cachePath = this._pathRewritesToCommit();
    const rewriteMap = this.store.reads.get<Record<string, string>>(cachePath);

    Object.entries(rewriteMap).forEach(([filePath, code]) => {
      this.overwriteProtection(filePath);
      writeFileSync(filePath, code);
    });
  };

  public loadRoutes = async () => {
    const appDir = Utils.getAppDir();

    const pageRoutes = (await glob(`${appDir}/**/page.{js,ts,jsx,tsx}`)).map(
      (pageFile) => ({
        name: Utils.removeExt(pageFile).replace(appDir, "") || "/page",
        entries: [
          "page",
          "template",
          "loading",
          ...Utils.getParentLayouts(pageFile),
        ]
          .map((entryFile) =>
            Utils.withCorrectExt(
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
      name: Utils.removeExt(notFoundFile).replace(appDir, "") || "/not-found",
      entries: [notFoundFile],
      files: [],
    }));

    const errorRoutes = (
      await glob(`${appDir}/**/{error,global-error}.{js,ts,jsx,tsx}`)
    )
      .map(Utils.removeExt)
      .filter((errorFileWithoutExt, _i, filesWithoutExt) => {
        const hasGlobalError =
          filesWithoutExt.indexOf(resolve(appDir, "global-error")) !== -1;
        const isRootErrorFile =
          errorFileWithoutExt === resolve(appDir, "error");
        const shouldRemove = hasGlobalError && isRootErrorFile;

        return !shouldRemove;
      })
      .map(Utils.withCorrectExt)
      .map((errorFile) => ({
        name: Utils.removeExt(errorFile).replace(appDir, "") || "/error",
        entries:
          Utils.removeExt(basename(errorFile)) === "global-error"
            ? [errorFile]
            : [errorFile, ...Utils.getParentLayouts(errorFile)],
        files: [],
      }));

    this.store.registerAccessPath(this._pathRewritesToCommit(), {});
    this.store.registerAccessPath(this._pathAppCollection(), []);
    [...pageRoutes, ...notFoundRoutes, ...errorRoutes].forEach((route) => {
      const routePath = this._pathRoute(route.name);
      this.store.registerAccessPath(
        this._pathRouteRewriteHistory(route.name),
        []
      );
      this.store.registerAccessPath(this._pathRouteCollection(route.name), []);

      const nextRoute = {
        ...route,
        files: route.entries
          .map((entry) => this.traversals.extractFilePaths(entry))
          .flat()
          .reduce(
            (unique, filePath) =>
              unique.includes(filePath) ? unique : unique.concat([filePath]),
            [] as Array<string>
          ),
      };

      const { clientComponents, serverComponents } = this._mapToComponentTypes(
        nextRoute.files
      );

      this.store.registerAccessPath(routePath, {
        ...nextRoute,
        clientComponents,
        serverComponents,
      });
    });
  };
}

export default SApp;
