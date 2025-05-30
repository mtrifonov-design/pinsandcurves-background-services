import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import peerDepsExternal from "rollup-plugin-peer-deps-external";
import replace from "@rollup/plugin-replace";

const packageJson = require("./package.json");

export default [
  {
    input: "src/ProjectState/index.ts",
    output: [
      {
        file: packageJson.exports["."].projectState,
        format: "cjs",
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve(),
      commonjs(),
      replace({
        "process.env.NODE_ENV": JSON.stringify("production"), // Replace with "production" or "development"
        preventAssignment: true, // Required to suppress warnings
      }),
      typescript({ tsconfig: "./tsconfig.json" }),
      //terser(),
    ],
  },
  {
    input: "src/TimelineProcessor/index.ts",
    output: [
      {
        file: packageJson.exports["."].timelineProcessor,
        format: "cjs",
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve(),
      commonjs(),
      replace({
        "process.env.NODE_ENV": JSON.stringify("production"), // Replace with "production" or "development"
        preventAssignment: true, // Required to suppress warnings
      }),
      typescript({ tsconfig: "./tsconfig.json" }),
      //terser(),
    ],
  },
  {
    input: "src/AssetServer/index.ts",
    output: [
      {
        file: packageJson.exports["."].assetServer,
        format: "cjs",
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve(),
      commonjs(),
      replace({
        "process.env.NODE_ENV": JSON.stringify("production"), // Replace with "production" or "development"
        preventAssignment: true, // Required to suppress warnings
      }),
      typescript({ tsconfig: "./tsconfig.json" }),
      //terser(),
    ],
  },
  {
    input: "src/AssetServerV2/index.ts",
    output: [
      {
        file: packageJson.exports["."].assetServerV,
        format: "cjs",
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve(),
      commonjs(),
      replace({
        "process.env.NODE_ENV": JSON.stringify("production"), // Replace with "production" or "development"
        preventAssignment: true, // Required to suppress warnings
      }),
      typescript({ tsconfig: "./tsconfig.json" }),
      //terser(),
    ],
  },
  {
    input: "src/CopilotEval/index.ts",
    output: [
      {
        file: packageJson.exports["."].copilotEval,
        format: "cjs",
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve(),
      commonjs(),
      replace({
        "process.env.NODE_ENV": JSON.stringify("production"), // Replace with "production" or "development"
        preventAssignment: true, // Required to suppress warnings
      }),
      typescript({ tsconfig: "./tsconfig.json" }),
      //terser(),
    ],
  },
  {
    input: "src/CopilotData/index.ts",
    output: [
      {
        file: packageJson.exports["."].copilotData,
        format: "cjs",
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve(),
      commonjs(),
      replace({
        "process.env.NODE_ENV": JSON.stringify("production"), // Replace with "production" or "development"
        preventAssignment: true, // Required to suppress warnings
      }),
      typescript({ tsconfig: "./tsconfig.json" }),
      //terser(),
    ],
  },

];