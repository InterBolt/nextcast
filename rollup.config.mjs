import terser from "@rollup/plugin-terser";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

import pkg from "./package.json" assert { type: "json" };

export default [
  {
    input: `src/index.ts`,
    output: [
      {
        file: pkg.main,
        format: "cjs",
        sourcemap: true,
      },
    ],
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: "./tsconfig.json" }),
      terser(),
    ],
  },
  {
    input: `dist/cjs/index.d.ts`,
    output: [{ file: `dist/index.d.ts`, format: "cjs" }],
    plugins: [dts()],
  },
];
