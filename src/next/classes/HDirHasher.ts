import { dirname, isAbsolute, join, resolve } from "path";
import * as Utils from "../utils";
import constants from "../constants";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { createHash } from "crypto";
import { glob } from "glob";

class HDirHasher {
  public sourceCodeHash: string;
  public hashDir: string;

  constructor() {}

  private _safeDir = (dirOrPath: string) => {
    let path = (dirOrPath = isAbsolute(dirOrPath)
      ? dirOrPath
      : resolve(Utils.getProjectRoot(), dirOrPath));
    if (!path.startsWith(Utils.getProjectRoot())) {
      throw new Error(`${path} is not within ${Utils.getProjectRoot()}`);
    }

    return path;
  };

  private getDirectoryHash = (dir: string, excludeFiles?: Array<string>) => {
    const dirPath = this._safeDir(dir);
    const allFiles = [];

    const grabAllFiles = (nextDir: string) => {
      const files = readdirSync(nextDir, { withFileTypes: true });
      for (const file of files) {
        if (file.isDirectory()) {
          grabAllFiles(join(nextDir, file.name));
        } else {
          allFiles.push(join(nextDir, file.name));
        }
      }
    };

    grabAllFiles(dirPath);

    const finalFiles = allFiles
      .filter(
        (file) =>
          !(excludeFiles || []).some((excludedFilename) =>
            file.endsWith(excludedFilename)
          )
      )
      .filter(
        (file) =>
          !file.includes(".next/") &&
          !file.includes(".git/") &&
          !file.includes("dist/")
      );

    if (finalFiles.length === 0) {
      return "";
    }

    const hexes = [];
    for (const file of finalFiles) {
      const buffer = readFileSync(file);
      const hash = createHash("sha256");
      hash.update(buffer);
      const hex = hash.digest("hex");
      hexes.push(hex);
    }
    return createHash("sha256").update(hexes.join("")).digest("hex");
  };

  private getSourceDirs = async () => {
    const projectRootPath = Utils.getProjectRoot();
    let gitignored = [];
    let tsconfig = { exclude: [] };
    const tsconfigPath = resolve(projectRootPath, "tsconfig.json");
    if (existsSync(tsconfigPath)) {
      tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
    }
    const gitignorePath = resolve(projectRootPath, ".gitignore");
    if (existsSync(gitignorePath)) {
      gitignored = readFileSync(gitignorePath, "utf8")
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s)
        .filter((s) => !s.startsWith("# "));
    }
    [gitignored, tsconfig.exclude].forEach((arr) => {
      arr.forEach((_s, i) => {
        if (arr[i].startsWith("/")) {
          arr[i] = arr[i].slice(1);
        }
        if (arr[i].endsWith("/")) {
          arr[i] = arr[i].slice(0, -1);
        }
        const lastStr = arr[i].split("/").at(-1);
        const secondToLastStr = arr[i].split("/").at(-2) || "";
        const shouldAddDoubleAsterisk =
          !lastStr.includes("*") && !secondToLastStr.includes("*");
        if (shouldAddDoubleAsterisk) {
          arr[i] = `${arr[i]}/**`;
        }
      });
    });

    const excludes = [
      ...gitignored,
      ...tsconfig.exclude,
      // some common sense excludes
      // in case we can't tell from
      // their gitignore or tsconfig
      "dist/**",
      ".next/**",
      "node_modules/**",
    ];
    const includes = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"];
    const includedDirectories = [];
    const matches = await glob(includes, {
      cwd: projectRootPath,
      ignore: excludes,
      dot: false,
    });

    matches.forEach((match) => {
      const directory = dirname(match);
      if (!includedDirectories.includes(directory)) {
        includedDirectories.push(directory);
      }
    });

    const dirs = includedDirectories
      .filter((d) => d !== ".")
      .slice(1)
      .sort();
    return dirs;
  };

  private getSourceCodeHash = async (excludeFiles?: Array<string>) => {
    const sourceDirs = await this.getSourceDirs();
    return createHash("sha256")
      .update(
        sourceDirs
          .map((dir) => this.getDirectoryHash(dir, excludeFiles))
          .filter((s) => s)
          .join("")
      )
      .digest("hex");
  };

  public init = () => {
    const dataDir = resolve(Utils.getProjectRoot(), `.${constants.name}`);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir);
    }

    this.hashDir = resolve(dataDir, constants.hashDir);
    if (!existsSync(this.hashDir)) {
      mkdirSync(this.hashDir);
    }

    const filesInHashDir = readdirSync(this.hashDir)
      .map((name) => resolve(this.hashDir, name))
      .filter((path) => statSync(path).isFile());

    filesInHashDir.forEach((path) => unlinkSync(path));
  };

  public runWhenChanged = async <Run extends (...args: any[]) => any>(
    run: Run,
    opts?: {
      namespace?: string;
      dir?: string;
      excludeFiles?: string[];
    }
  ): Promise<ReturnType<Run> | undefined> => {
    const {
      excludeFiles = [],
      namespace = "sourcecode",
      dir = null,
    } = opts || {};

    const hash = dir
      ? this.getDirectoryHash(this._safeDir(dir), excludeFiles)
      : await this.getSourceCodeHash();
    const cachePath = resolve(this.hashDir, `${namespace}.txt`);

    const cachedHash = (() => {
      try {
        return readFileSync(cachePath, "utf8");
      } catch (e) {
        return "";
      }
    })();

    if (cachedHash === hash) {
      return;
    }

    writeFileSync(cachePath, hash);

    const result = await run();

    return result;
  };
}

export default HDirHasher;
