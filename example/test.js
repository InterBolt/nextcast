const glob = require("glob");
const { dirname } = require("path");

const getIncludedDirs = (exclude, include) => {
  let includedDirectories = [];
  const fixedExcludes = exclude.map(s => s.endsWith('**') ? s : `${s}/**`);

  include.forEach((pattern) => {
    const matches = glob.sync(pattern, { ignore: fixedExcludes });
    matches.forEach((match) => {
      const directory = dirname(match);
      if (!includedDirectories.includes(directory)) {
        includedDirectories.push(directory);
      }
    });
  });

  return includedDirectories;
};

console.log(getIncludedDirs(
  ["node_modules"],
  ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
))