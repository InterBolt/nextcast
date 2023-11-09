import * as Types from "../types";
import * as Utils from "../utils";
import { get, set } from "lodash";
import jscodeshift, { Collection } from "jscodeshift";

class Cache {
  private _history: Array<any> = [];
  private _unsafeCache: any = {};
  private _unsafeMacroName: string;

  constructor() {}

  private _getMacroName = () => {
    if (typeof this._unsafeMacroName === "undefined") {
      throw new Error(`Cannot set cache without a macro name.`);
    }
    return this._unsafeMacroName;
  };

  private _setCache = (path: Array<string>, value: any) => {
    const macroName = this._getMacroName();
    set(this._unsafeCache, [macroName, ...path], value);
  };

  private _getCache = (path: Array<string>) => {
    const macroName = this._getMacroName();
    return get(this._unsafeCache, [macroName, ...path]);
  };

  public open = (
    macroName: string,
    segments: Array<Types.CollectorSegment> = []
  ): void => {
    this._unsafeMacroName = macroName;
    this._setCache([], {});
    segments.forEach((segment) => {
      this._setCache(["segments", segment.name], segment);
    });
  };

  public close = (): void => {
    this._history.unshift(this._unsafeCache);
    this._unsafeCache = {};
    this._unsafeMacroName = undefined;
    return this._history[0];
  };

  public getHistory = (): Array<any> => {
    return this._history;
  };

  public pushError = (
    message: string,
    filePath: string,
    astPath: jscodeshift.ASTPath<any>
  ): void => {
    const errors = this._getCache(["errors"]);
    if (typeof errors === "undefined") {
      this._setCache(["errors"], []);
    }
    errors.push(
      Utils.buildError(this._getMacroName(), filePath, astPath, message)
    );
  };

  public getErrors = (): Array<string> => {
    return this._getCache(["errors"]) || [];
  };

  public getSegments = (): Array<Types.CollectorSegment> => {
    return Object.values(this._getCache(["segments"]) || {});
  };

  public getSegment = (segmentName: string): Types.CollectorSegment => {
    return this._getCache(["segments", segmentName]);
  };

  public pushSegmentData = (segmentName: string, data: any): Array<any> => {
    try {
      JSON.stringify(data);
    } catch (err) {
      throw new Error(
        `Cannot push data to segment ${segmentName} because it is not JSON serializable.`
      );
    }
    if (typeof this._getCache(["data"]) === "undefined") {
      this._setCache(["data"], {});
    }
    console.log(this._getCache(["data", segmentName]));
    const dataset = this._getCache(["data", segmentName]) || [];
    if (!dataset.length) {
      this._setCache(["data", segmentName], dataset);
    }
    dataset.push(data);

    return dataset;
  };

  public pushData = (data: any): Array<any> => {
    try {
      JSON.stringify(data);
    } catch (err) {
      throw new Error(`Cannot push data because it is not JSON serializable.`);
    }
    const dataset = this._getCache(["global-data"]) || [];
    if (!dataset.length) {
      this._setCache(["global-data"], dataset);
    }
    dataset.push(data);
    return data;
  };

  public addRewrite = (
    filePath: string,
    modifiedCode: string | Collection<any>
  ): void => {
    const rewrites = this._getCache(["rewrites"]) || {};
    if (!Object.keys(rewrites).length) {
      this._setCache(["rewrites"], rewrites);
    }
    if (typeof modifiedCode === "string") {
      rewrites[filePath] = modifiedCode;
      return;
    }
    rewrites[filePath] = modifiedCode.toSource();
  };

  public getRewrites = (): Record<string, string> => {
    return this._getCache(["rewrites"]) || {};
  };

  public getSegmentData = (): Record<string, Array<any>> => {
    return this._getCache(["data"]) || {};
  };

  public getData = (): Array<any> => {
    return this._getCache(["global-data"]) || [];
  };

  public getCollectedFile = (filePath: string): Types.CollectorFile => {
    return this._getCache(["parsed", filePath]);
  };

  public addCollectedFile = (
    segmentName: string,
    collectionFile: Types.CollectorFile
  ): void => {
    const segment = this._getCache([
      "segments",
      segmentName,
    ]) as Types.CollectorSegment;
    if (this._getCache(["segments", segmentName]) === undefined) {
      throw new Error(`Segment ${segmentName} does not exist in cache yet.`);
    }
    segment.files.push(collectionFile);
    this._setCache(["parsed", collectionFile.filePath], collectionFile);
  };
}

export default Cache;
