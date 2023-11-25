import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import type { IErrorOrWarning } from "@src/classes/SErrors";
import Store from "@src/classes/Store/index";
import constants from "@src/constants";
import { JSONValue, NextCtx, Route } from "@src/types";
import { uniq } from "lodash";
import nextSpec from "@src/next/nextSpec";
import { writeFile } from "fs/promises";
import SCodemod from "@src/classes/SCodemod";
import log from "@log";

class SApp {
  private store: Store;
  private codemod: SCodemod;

  constructor(store: Store, codemod: SCodemod) {
    this.codemod = codemod;
    this.store = store;
  }

  private overwriteProtection = (path: string) => {
    if (!path.startsWith(nextSpec.getProjectRoot())) {
      throw new Error(
        `Cannot overwrite ${path} because it is not in the project root.`
      );
    }
  };

  private _pathToInitializedTransforms = ["initialized_transforms"] as const;
  private _pathToFileTransforms = (filePath: string) =>
    ["transforms", filePath] as const;

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

  public queueTransform = (
    filePath: string,
    transform: Parameters<SCodemod["modify"]>[1]
  ) => {
    const initializedTransforms = this.store.reads.get<Record<string, any>>(
      this._pathToInitializedTransforms
    );
    if (!initializedTransforms[filePath]) {
      this.store.registerAccessPath(this._pathToFileTransforms(filePath), []);
    }
    this.store.writes.merge(this._pathToInitializedTransforms, {
      [filePath]: true,
    });
    this.store.writes.push(this._pathToFileTransforms(filePath), transform);
  };

  public transform = async (currentTransforms: Record<string, string> = {}) => {
    // Get the queued transforms where keys are file names
    // and values are arrays of transforms to apply to the file
    const queuedTransforms = this.store.reads.get<Record<string, any>>(
      this._pathToInitializedTransforms
    );

    // run the transforms in order against either the filesystem or the previous
    // transforms.
    const nextTransforms = Object.keys(queuedTransforms)
      .sort()
      .reduce((accumTransforms: Record<string, string>, filePath: string) => {
        type Transform = Parameters<SCodemod["modify"]>[1];
        const transforms: Array<Transform> =
          this.store.reads.get<Array<Transform>>(
            this._pathToFileTransforms(filePath)
          ) || [];
        if (!Array.isArray(transforms)) {
          throw new Error(
            `Expected transforms to be an array for ${filePath}. Found: ${typeof transforms}}: ${transforms}`
          );
        }

        // If there are no transforms, then just return the previous transforms
        // and log a warning since this is probably a mistake.
        if (!transforms.length) {
          log.warn(
            `An empty array was found for file: ${filePath.replace(
              nextSpec.getProjectRoot(),
              ""
            )} transforms in plugin: ${this.store._unsafePluginName}.`
          );
          return accumTransforms;
        }

        // Queued transforms should always modify the previous transforms
        // rather than the raw source code.
        let modifiedCode: string;
        transforms.forEach((transform) => {
          const codeToModify =
            modifiedCode ||
            accumTransforms[filePath] ||
            readFileSync(filePath, "utf-8");
          modifiedCode = this.codemod.modify(codeToModify, transform);
        });

        // Overwrite the previous transforms with the new transforms
        accumTransforms[filePath] = modifiedCode;
        return accumTransforms;
      }, currentTransforms);

    return nextTransforms;
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

  public loadNextCtx = (ctx: NextCtx) => {
    const { routes } = ctx;

    this.store.registerAccessPath(this._pathToInitializedTransforms, {});
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
