import { basename, dirname, resolve } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import constants from "./constants";

export const stripIndent = (str: string) => {
  const match = str.match(/^[^\S\n]*(?=\S)/gm);
  const indent = match && Math.min(...match.map((el) => el.length));
  if (indent) {
    const regexp = new RegExp(`^.{${indent}}`, "gm");
    str = str.replace(regexp, "");
  }
  return str.trim();
};

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
      throw new Error(
        `We expected ${filePath} to have a valid extension: ${validExts.join(
          ", "
        )}`
      );
    }
    return fallbackValue;
  }
  return `${withoutExt}.${correctExt}`;
};

export const getProjectRoot = (): string => {
  const possibleExts = ["js", "mjs", "cjs", "mts", "cts", "ts"];
  if (
    possibleExts.find((ext) =>
      existsSync(resolve(process.cwd(), `next.config.${ext}`))
    )
  ) {
    return process.cwd();
  }
  throw new Error(
    `Must run from within a Next.js project. Couldn't find a next.config.{${possibleExts.join(
      ", "
    )}}`
  );
};

export const getDataDir = () => {
  return resolve(getProjectRoot(), constants.dataDirname);
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

export const addToGitignore = (dataDir: string, gitignored: Array<string>) => {
  const projectRoot = getProjectRoot();
  const dataDirPath = resolve(projectRoot, dataDir);
  if (!existsSync(dataDirPath)) {
    throw new Error(`Data directory ${dataDirPath} does not exist.`);
  }
  const gitignorePath = resolve(dataDirPath, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, "");
  }
  const currentGitignoreLines = readFileSync(gitignorePath, "utf8")
    .split("\n")
    .map((s: string) => s.trim())
    .filter((s: string) => s);

  const nextGitignoreLines = gitignored
    .map((line) => {
      if (!currentGitignoreLines.includes(line)) {
        return line;
      }
    })
    .map((line) => line);

  if (nextGitignoreLines.length > 0) {
    currentGitignoreLines.push("");
  }
  currentGitignoreLines.push(...nextGitignoreLines);
  writeFileSync(gitignorePath, currentGitignoreLines.join("\n").trim());
};
