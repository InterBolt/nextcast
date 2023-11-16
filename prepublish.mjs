import commonjs from "@rollup/plugin-commonjs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function main() {
  const pathToEslintPluginPackageJSON = resolve(
    __dirname,
    "eslint-plugin-micropack/package.json"
  );
  const pathToRootPackageJSON = resolve(__dirname, "package.json");
  const rootPkg = JSON.parse(readFileSync(pathToRootPackageJSON, "utf-8"));
  const version = rootPkg.version;
  const name = rootPkg.name;
  const eslintPluginPkg = JSON.parse(
    readFileSync(pathToEslintPluginPackageJSON, "utf8")
  );
  rootPkg.peerDependencies = rootPkg.peerDependencies || {};
  rootPkg.peerDependencies[eslintPluginPkg.name] = version;
  rootPkg.devDependencies = rootPkg.devDependencies || {};
  rootPkg.devDependencies[eslintPluginPkg.name] = version;

  eslintPluginPkg.version = version;
  eslintPluginPkg.name = name.replace(
    "@interbolt/",
    "@interbolt/eslint-plugin-"
  );

  writeFileSync(
    pathToEslintPluginPackageJSON,
    JSON.stringify(eslintPluginPkg, null, 2)
  );
  writeFileSync(pathToRootPackageJSON, JSON.stringify(rootPkg, null, 2));
}

main();
