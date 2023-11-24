import { resolve } from "path";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import type STraversals from "./STraversals";
import type { IErrorOrWarning } from "./SErrors";
import Store from "./Store/index";
import constants from "../constants";
import { JSONValue, NextCtx, Route } from "../types";
import { uniq } from "lodash";
import nextSpec from "../next/nextSpec";
import { readdir, writeFile } from "fs/promises";

class SApp {
  private store: Store;
  private traversals: STraversals;

  constructor(store: Store, traversals: STraversals) {
    this.traversals = traversals;
    this.store = store;
  }

  private overwriteProtection = (path: string) => {
    if (!path.startsWith(nextSpec.getProjectRoot())) {
      throw new Error(
        `Cannot overwrite ${path} because it is not in the project root.`
      );
    }
  };

  private _pathRewriteHistory = ["rewrite_history"] as const;

  private _pathDangerousRewriteHistory = ["dangerous_rewrite_history"] as const;

  private _pathRewritesToCommit = ["rewrites_to_commit"] as const;

  private _pathDangerousRewritesToCommit = [
    "dangerous_rewrites_to_commit",
  ] as const;

  private _pathCollection = (routeName: string) =>
    ["route_collections", routeName] as const;

  private _pathAllRoutes = (routeName?: string) => {
    if (typeof routeName === "string") {
      return ["routes", routeName] as const;
    }
    return ["routes"] as const;
  };

  private _path = (routeName: string) => ["routes", routeName] as const;

  private _pathToAppSaved = ["saves"] as const;
  private _pathAppCollection = ["route_type_collection"] as const;

  public queueRewrite = (filePath: string, code: string) => {
    this.store.writes.merge<string>(this._pathRewritesToCommit, {
      [filePath]: code,
    });

    this.store.writes.push(this._pathRewriteHistory, {
      filePath,
      code,
    });
  };

  public dangerouslyQueueRewrite = (filePath: string, newCode: string) => {
    this.store.writes.merge<string>(this._pathDangerousRewritesToCommit, {
      [filePath]: newCode,
    });

    this.store.writes.push(this._pathDangerousRewriteHistory, {
      filePath,
      code: newCode,
    });
  };

  public collect = (data: JSONValue) => {
    try {
      JSON.stringify(data);
    } catch (err) {
      throw new Error(
        `Cannot collect data because it is not JSON serializable.`
      );
    }

    const dataset = this.store.reads.get<Array<JSONValue>>(
      this._pathAppCollection
    );

    if (!Array.isArray(dataset)) {
      throw new Error(`Cannot push data to route because it is not an array.`);
    }

    dataset.push(data);
  };

  public save = (data: JSONValue) => {
    try {
      JSON.stringify(data);
    } catch (err) {
      throw new Error(
        `Cannot collect data because it is not JSON serializable.`
      );
    }

    const dataset = this.store.reads.get<Array<JSONValue>>(
      this._pathToAppSaved
    );

    if (!Array.isArray(dataset)) {
      throw new Error(`Cannot push data to route because it is not an array.`);
    }

    dataset.unshift(data);
  };

  public getCollected = () =>
    JSON.parse(
      JSON.stringify(
        this.store.reads.get<Array<JSONValue>>(this._pathAppCollection) || []
      )
    );

  public getSaved = () =>
    JSON.parse(
      JSON.stringify(
        (this.store.reads.get<Array<JSONValue>>(this._pathToAppSaved) || [])[0]
      )
    );

  public getSavedHistory = () =>
    JSON.parse(
      JSON.stringify(
        this.store.reads.get<Array<JSONValue>>(this._pathToAppSaved) || []
      )
    );

  public getSourceFiles = () => {
    const routes = this.getRoutes();
    return uniq(routes.map((route) => route.files).flat());
  };

  public getRoutes = (providedNames?: Array<string> | string): Array<Route> => {
    return this.getRouteNames(providedNames).map((name) =>
      this.store.reads.get<Route>(this._path(name))
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

  public stashCollection = async (dataDir: string) => {
    if (!existsSync(dataDir)) {
      throw new Error(
        `Cannot commit collection because ${dataDir} does not exist.`
      );
    }

    const cachePath = this._pathAppCollection;
    const collection = this.store.reads.get<Array<JSONValue>>(cachePath) || [];

    this.overwriteProtection(dataDir);
    await writeFile(
      resolve(dataDir, constants.collectionFileName),
      JSON.stringify(collection, null, 2)
    );
  };

  public stashSavedBuild = async (dataDir: string) => {
    if (!existsSync(dataDir)) {
      throw new Error(
        `Cannot commit reduced collection because ${dataDir} does not exist.`
      );
    }

    this.overwriteProtection(dataDir);
    writeFile(
      resolve(dataDir, constants.dataFileName),
      JSON.stringify(this.getSaved(), null, 2)
    );
  };

  private stashErrorsOrWarnings = async (
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

    await writeFile(dataPath, JSON.stringify(errorsOrWarnings, null, 2));
  };

  public stashErrors = async (
    dataDir: string,
    errors: Array<IErrorOrWarning>
  ) => this.stashErrorsOrWarnings(dataDir, errors, "error");

  public stashWarnings = async (
    dataDir: string,
    warnings: Array<IErrorOrWarning>
  ) => this.stashErrorsOrWarnings(dataDir, warnings, "warning");

  public getRewrites = () => {
    return {
      dangerous: {
        history: this.store.reads.get<
          Array<{ filePath: string; code: string }>
        >(this._pathDangerousRewriteHistory),
        toCommit: this.store.reads.get<Record<string, string>>(
          this._pathDangerousRewritesToCommit
        ),
      },
      loader: {
        history: this.store.reads.get<
          Array<{ filePath: string; code: string }>
        >(this._pathRewriteHistory),
        toCommit: this.store.reads.get<Record<string, string>>(
          this._pathRewritesToCommit
        ),
      },
    };
  };

  public getDangerousRewrites = () => {
    return this.store.reads.get<Record<string, string>>(
      this._pathDangerousRewritesToCommit
    );
  };

  public stashRewrites = async (dataDir: string) => {
    if (!existsSync(dataDir)) {
      throw new Error(
        `Cannot commit rewrites because ${dataDir} does not exist.`
      );
    }

    this.overwriteProtection(dataDir);
    await writeFile(
      resolve(dataDir, constants.rewritesFileName),
      JSON.stringify(this.getRewrites(), null, 2)
    );
  };

  public executeDangerousRewrites = async () => {
    const rewriteMap = this.store.reads.get<Record<string, string>>(
      this._pathDangerousRewritesToCommit
    );
    Object.keys(rewriteMap).map((filePath) => {
      this.overwriteProtection(filePath);
    });

    await Promise.all(
      Object.entries(rewriteMap).map(([filePath, code]) =>
        writeFile(filePath, code)
      )
    );
  };

  public loadNextCtx = (ctx: NextCtx) => {
    const { routes } = ctx;

    this.store.registerAccessPath(this._pathDangerousRewritesToCommit, {});
    this.store.registerAccessPath(this._pathDangerousRewriteHistory, []);
    this.store.registerAccessPath(this._pathRewritesToCommit, {});
    this.store.registerAccessPath(this._pathRewriteHistory, []);
    this.store.registerAccessPath(this._pathAppCollection, []);
    this.store.registerAccessPath(this._pathToAppSaved, []);
    routes.forEach((route) => {
      const { name } = route;
      const routeCachePath = this._path(name);
      this.store.registerAccessPath(this._pathCollection(name), []);
      this.store.registerAccessPath(routeCachePath, Object.freeze(route));
    });
  };
}

export default SApp;
