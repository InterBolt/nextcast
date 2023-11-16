import { basename, dirname, join, resolve } from "path";
import {
  exists,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import appRootPath from "app-root-path";
import { createHash } from "crypto";
import { glob } from "glob";
import constants from "./constants";

const getNestedDepthRelativePath = (basePath: string, nestedPath: string) => {
  const nestDistance = nestedPath.replace(basePath, "").split("/").length - 1;
  return [...Array(nestDistance).keys()].map(() => "..").join("/");
};

const onlyUnique = <TArrElement extends any>(
  value: TArrElement,
  index: number,
  array: Array<TArrElement>
): boolean => {
  return array.indexOf(value) === index;
};

const withoutAsterisk = (path: string) => [path.replaceAll("*", ""), path];

const resolveAliasedImport = (
  basePath: string,
  sourcePath: string,
  importPath: string,
  aliasPaths: Record<string, Array<string>>
) => {
  const currentDefaultPaths = Array.isArray(aliasPaths["*"])
    ? aliasPaths["*"]
    : [];
  const aliases = Object.keys({
    ...aliasPaths,
    "*": [...currentDefaultPaths, "node_modules/*"].filter(onlyUnique),
  });
  const potentialPaths = aliases
    .map(withoutAsterisk)
    .map(([aliasWithoutAsterisk, alias]) => {
      const unaliasedPaths = importPath.startsWith(aliasWithoutAsterisk)
        ? aliasPaths[alias]
            .map(withoutAsterisk)
            .map(([mappedPathWithoutAsterisk]) => {
              return resolve(
                sourcePath,
                getNestedDepthRelativePath(basePath, sourcePath),
                importPath.replace(
                  aliasWithoutAsterisk,
                  mappedPathWithoutAsterisk
                )
              );
            })
        : [resolve(sourcePath, "..", importPath)];

      const withGuessedExtensions = unaliasedPaths
        .concat(
          unaliasedPaths
            .map((unaliasedPath) => {
              const lastSubpath = unaliasedPath.split("/").at(-1);

              if (lastSubpath.includes(".")) {
                return [unaliasedPath];
              }

              return [
                unaliasedPath + ".ts",
                unaliasedPath + ".tsx",
                unaliasedPath + ".js",
                unaliasedPath + ".jsx",
              ];
            })
            .flat()
        )
        .flat();

      return withGuessedExtensions;
    })
    .flat()
    .filter(onlyUnique)
    .sort((a, b) => b.length - a.length);

  // find which of the two potentialPaths the correct path is when combined with the basePath
  const correctPath = potentialPaths.find((e) => existsSync(e));

  if (!correctPath) {
    throw new Error(
      `Could not resolve possible paths: ${potentialPaths.join(", ")}`
    );
  }

  return correctPath;
};

export const validExts = ["js", "ts", "tsx", "jsx"];

export const routeGroupRegex = /^.*\(.*\)$/;

export const removeExt = (filePath: string): string => {
  if (validExts.find((ext) => filePath.endsWith(`.${ext}`))) {
    return filePath.slice(0, filePath.lastIndexOf("."));
  }
  return filePath;
};

export const withCorrectExt = (
  filePath: string,
  fallbackValue?: any
): string => {
  const withoutExt = removeExt(filePath);
  const correctExt = validExts.find((ext) =>
    existsSync(`${withoutExt}.${ext}`)
  );
  if (!correctExt) {
    if (typeof fallbackValue === "undefined") {
      throw new Error(`No valid extension found for ${filePath}`);
    }
    return fallbackValue;
  }
  return `${withoutExt}.${correctExt}`;
};

export const getProjectRoot = (): string => {
  const isCWDNextJSProject = existsSync(
    resolve(process.cwd(), "next.config.js")
  );
  if (isCWDNextJSProject) {
    return process.cwd();
  }
  const isRootNextJSProject = existsSync(
    resolve(appRootPath.path, "next.config.js")
  );
  if (isRootNextJSProject) {
    return appRootPath.path;
  }
  throw new Error("Can't locate a NextJS project.");
};

export const getAppDir = (rootPath?: string): string => {
  if (!rootPath) {
    rootPath = getProjectRoot();
  }
  const isNextJSProject = existsSync(resolve(rootPath, "next.config.js"));
  if (!isNextJSProject) {
    throw new Error(
      "Not a Next.js project. Can't locate a NextJS app router directory."
    );
  }
  const topLevelAppDir = resolve(rootPath, "app");
  if (existsSync(topLevelAppDir)) {
    return topLevelAppDir;
  }
  const srcLevelAppDir = resolve(rootPath, "src", "app");
  if (existsSync(srcLevelAppDir)) {
    return srcLevelAppDir;
  }
  let foundPagesDir: string;
  const topLevelPagesDir = resolve(rootPath, "app");
  if (existsSync(topLevelPagesDir)) {
    foundPagesDir = topLevelPagesDir;
  }
  const srcLevelPagesDir = resolve(rootPath, "src", "app");
  if (existsSync(srcLevelPagesDir)) {
    foundPagesDir = srcLevelPagesDir;
  }
  if (foundPagesDir) {
    throw new Error(
      "You must use the new NextJS app router directory structure. See https://nextjs.org/docs"
    );
  }
  throw new Error(
    "Can't locate a NextJS app or pages directory. Are you sure this is a valid NextJS project?"
  );
};

export const getParentLayouts = (
  routeFile: string,
  layouts = []
): Array<string> => {
  const appDir = getAppDir();
  const routeFileName = removeExt(basename(routeFile));
  const rootLayouDirPath = withCorrectExt(resolve(appDir, "layout"));
  const pageDirPath = dirname(routeFile);
  const pageDirName = basename(dirname(routeFile));
  const parentDirPath = resolve(pageDirPath, "..");
  const grandparentDirPath = resolve(pageDirPath, "..", "..");

  if (appDir === pageDirPath) {
    layouts.push(rootLayouDirPath);
    return layouts;
  }

  const layoutPath = withCorrectExt(routeFile);
  if (!existsSync(layoutPath)) {
    return getParentLayouts(parentDirPath, layouts);
  }

  layouts.push(layoutPath);

  const isInRouteGroup = routeGroupRegex.test(pageDirName);
  if (isInRouteGroup) {
    if (grandparentDirPath === appDir) {
      layouts.push(rootLayouDirPath);
      return layouts;
    }
    return getParentLayouts(
      withCorrectExt(resolve(grandparentDirPath, "layout")),
      layouts
    );
  }

  return getParentLayouts(
    withCorrectExt(resolve(parentDirPath, routeFileName)),
    layouts
  );
};

export const resolveImport = (filePath: string, importPath: string) => {
  const projectRoot = getProjectRoot();
  const tsconfig = (() => {
    try {
      return require(resolve(projectRoot, "tsconfig.json"));
    } catch (err) {
      return undefined;
    }
  })();
  return resolveAliasedImport(getProjectRoot(), filePath, importPath, {
    ...(tsconfig?.compilerOptions?.paths || {}),
    ["*"]: ["node_modules/*"],
  });
};

// concat all files hashes and hash the hashes
export const dirHash = (dir: string) => {
  function* walkSync(dir: string) {
    const files = readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      if (file.isDirectory()) {
        yield* walkSync(join(dir, file.name));
      } else {
        yield join(dir, file.name);
      }
    }
  }

  const hexes = [];
  for (const file of walkSync(dir)) {
    const buffer = readFileSync(file);
    const hash = createHash("sha256");
    hash.update(buffer);
    const hex = hash.digest("hex");
    hexes.push(hex);
  }
  return createHash("sha256").update(hexes.join("")).digest("hex");
};

export const getSourceDirs = (
  exclude: Array<string> = ["node_modules"],
  include: Array<string> = ["./**/*"]
) => {
  let includedDirectories = [];
  const fixedExcludes = exclude.map((s) => (s.endsWith("**") ? s : `${s}/**`));
  const fixedIncludes = include.map((s) => (s === "." ? "./**" : s));
  fixedIncludes.forEach((pattern) => {
    const matches = glob.sync(pattern, { ignore: fixedExcludes });
    matches.forEach((match) => {
      const directory = dirname(match);
      if (!includedDirectories.includes(directory)) {
        includedDirectories.push(directory);
      }
    });
  });

  return includedDirectories.filter((d) => d !== ".").slice(1);
};

export const getSourceCodeHash = (
  exclude: Array<string> = ["node_modules"],
  include: Array<string> = ["./**/*"]
) => {
  const hashes = getSourceDirs(exclude, include)
    .filter((d) => d !== ".")
    .slice(1)
    .map((dir) => dirHash(dir));

  return createHash("sha256").update(hashes.join("")).digest("hex");
};

export const runWhenChanged = <Run extends (...args: any[]) => any>(
  dir: string,
  run: Run
): ReturnType<Run> | undefined => {
  const hash = getSourceCodeHash(
    ["node_modules", "dist"],
    [resolve(getProjectRoot(), dir) + "/**"]
  );

  const cacheDirPath = resolve(
    getProjectRoot(),
    `.${constants.name}`,
    ".cache"
  );

  if (!existsSync(cacheDirPath)) {
    mkdirSync(cacheDirPath);
  }

  const cachePath = resolve(cacheDirPath, `${hash}.txt`);

  const cachedHash = (() => {
    try {
      return readFileSync(cachePath, "utf8");
    } catch (err) {
      return "";
    }
  })();

  if (cachedHash === hash) {
    return;
  }

  const result = run();
  writeFileSync(cachePath, hash);

  return result;
};
