import { resolve } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";

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

export const resolveImport = (
  rootDir: string,
  filePath: string,
  importPath: string
) => {
  const tsconfig = (() => {
    try {
      return require(resolve(rootDir, "tsconfig.json"));
    } catch (err) {
      return undefined;
    }
  })();
  return resolveAliasedImport(rootDir, filePath, importPath, {
    ...(tsconfig?.compilerOptions?.paths || {}),
    ["*"]: ["node_modules/*"],
  });
};

export const addToDatadirGitignore = (
  dir: string,
  dataDir: string,
  gitignored: Array<string>
) => {
  const dataDirPath = resolve(dir, dataDir);
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

export const getPackageDeps = (dir?: string) => {
  dir = dir || process.cwd();
  const pathToPkg = resolve(dir, "package.json");
  if (!existsSync(pathToPkg)) {
    throw new Error(`No package.json found at ${pathToPkg}`);
  }
  const packageJsonFile = readFileSync(resolve(dir, "package.json"), "utf8");
  const parsedPackageJson = JSON.parse(packageJsonFile);
  const devDependencies = parsedPackageJson.devDependencies || {};
  const dependencies = parsedPackageJson.dependencies || {};
  return {
    dependencies,
    devDependencies,
    all: {
      ...devDependencies,
      ...dependencies,
    },
  };
};

export const removeExtension = (filePath: string) => {
  return filePath.replace(/\.[^/.]+$/, "");
};
