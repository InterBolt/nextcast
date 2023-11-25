import { dirname, isAbsolute, join, resolve } from "path";
import * as Utils from "@src/utils";
import constants from "@src/constants";
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
import nextSpec from "@src/next/nextSpec";

class HHasher {
  public initialized = false;
  public sourceCodeHash: string;
  public hashDir: string;

  constructor() {}

  private _fixGlobs = (globs: Array<string>) => {
    return globs.map((_s, i) => {
      let globPattern = globs[i];
      if (globPattern.startsWith("/")) {
        globPattern = globPattern.slice(1);
      }
      if (globPattern.endsWith("/")) {
        globPattern = globPattern.slice(0, -1);
      }
      const lastStr = globPattern.split("/").at(-1);
      const secondToLastStr = globPattern.split("/").at(-2) || "";
      const shouldAddDoubleAsterisk =
        !lastStr.includes("*") && !secondToLastStr.includes("*");
      if (shouldAddDoubleAsterisk) {
        globPattern = `${globPattern}/**`;
      }
      return globPattern;
    });
  };

  private _safeDir = (dirOrPath: string) => {
    const projectRoot = nextSpec.getProjectRoot();
    let path = isAbsolute(dirOrPath)
      ? dirOrPath
      : resolve(projectRoot, dirOrPath);
    if (!path.startsWith(projectRoot)) {
      throw new Error(`${path} is not within ${projectRoot}`);
    }

    return path;
  };

  private _getDirectoryHash = (dir: string) => {
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

    const finalFiles = allFiles.filter(
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

  private _getSourceDir = async (dir: string) => {
    const safeDir = this._safeDir(dir);
    let gitignored = [];
    let tsconfig = { exclude: [] };

    const tsconfigPath = resolve(safeDir, "tsconfig.json");
    if (existsSync(tsconfigPath)) {
      tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
    }

    const gitignorePath = resolve(safeDir, ".gitignore");
    if (existsSync(gitignorePath)) {
      gitignored = readFileSync(gitignorePath, "utf8")
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s)
        .filter((s) => !s.startsWith("# "));
    }

    const includes = ["**/*"];
    const includedDirectories = [];
    const includedFiles = [];
    const matches = await glob(includes, {
      cwd: safeDir,
      dot: false,
      ignore: [
        ...this._fixGlobs(gitignored),
        ...this._fixGlobs(tsconfig.exclude),
        // some common sense excludes
        // in case we can't tell from
        // their gitignore or tsconfig
        ...constants.watchExcludes,
      ],
    });

    matches
      // filter out nested dot folders since that will rarely be
      // source code.
      .filter((match) => !match.includes("/."))
      .forEach((match) => {
        const directory = dirname(match);
        if (
          directory === "." &&
          statSync(resolve(safeDir, match)).isFile() &&
          !includedFiles.includes(match)
        ) {
          includedFiles.push(match);
        }
        if (!includedDirectories.includes(directory)) {
          includedDirectories.push(directory);
        }
      });

    const returnData = {
      dirs: includedDirectories
        .filter((d) => d !== ".")
        .sort()
        .map((dir) => resolve(safeDir, dir)),
      files: includedFiles.sort().map((file) => resolve(safeDir, file)),
    };

    return returnData;
  };

  private _getSourceCodeHash = async (dir: string) => {
    const { dirs: sourceDirs, files } = await this._getSourceDir(dir);
    return createHash("sha256")
      .update(
        files
          .map((file) =>
            createHash("sha256")
              .update(readFileSync(file, "utf8"))
              .digest("hex")
          )
          .join("") +
          sourceDirs
            .map((dir) => this._getDirectoryHash(dir))
            .filter((s) => s)
            .join("")
      )
      .digest("hex");
  };

  public init = () => {
    const dataDir = nextSpec.getDataDir();
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir);
    }

    this.hashDir = resolve(dataDir, constants.hashDir);
    if (!existsSync(this.hashDir)) {
      mkdirSync(this.hashDir);
    }

    Utils.addToDatadirGitignore(nextSpec.getProjectRoot(), dataDir, [
      `/${constants.hashDir}`,
    ]);

    const filesInHashDir = readdirSync(this.hashDir)
      .map((name) => resolve(this.hashDir, name))
      .filter((path) => statSync(path).isFile());

    filesInHashDir.forEach((path) => unlinkSync(path));
  };

  public runWhenChanged = async <Run extends (...args: any[]) => any>(
    run: Run,
    opts: {
      namespace: string;
      watchDir: string;
    }
  ): Promise<ReturnType<Run> | undefined> => {
    const { namespace = "sourcecode", watchDir = null } = opts;

    const hash = await this._getSourceCodeHash(watchDir);
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

export default HHasher;
