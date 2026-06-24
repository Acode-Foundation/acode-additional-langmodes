import * as esbuild from "esbuild";
import { exec } from "child_process";
import path from "path";

const isServe = process.argv.includes("--serve");

// Function to pack the ZIP file
function packZip() {
  exec("node ./pack-zip.js", (err, stdout, stderr) => {
    if (err) {
      console.error("Error packing zip:", err);
      return;
    }
    console.log(stdout.trim());
  });
}

// Custom plugin to pack ZIP after build or rebuild
const zipPlugin = {
  name: "zip-plugin",
  setup(build) {
    build.onEnd(() => {
      packZip();
    });
  },
};

const runtimeModules = {
  "@codemirror/autocomplete": "src/runtime/codemirror-autocomplete.js",
  "@codemirror/language": "src/runtime/codemirror-language.js",
  "@codemirror/lint": "src/runtime/codemirror-lint.js",
  "@codemirror/state": "src/runtime/codemirror-state.js",
  "@codemirror/view": "src/runtime/codemirror-view.js",
  "@lezer/common": "src/runtime/lezer-common.js",
  "@lezer/highlight": "src/runtime/lezer-highlight.js",
  "@lezer/lr": "src/runtime/lezer-lr.js",
};

const acodeRuntimePlugin = {
  name: "acode-runtime",
  setup(build) {
    build.onResolve({ filter: /^(@codemirror|@lezer)\// }, (args) => {
      const runtimePath = runtimeModules[args.path];
      if (!runtimePath) return;
      return { path: path.resolve(runtimePath) };
    });
  },
};

// Base build configuration
let buildConfig = {
  entryPoints: ["src/main.js"],
  bundle: true,
  minify: true,
  logLevel: "info",
  color: true,
  outdir: "dist",
  plugins: [acodeRuntimePlugin, zipPlugin],
};

// Main function to handle both serve and production builds
(async function () {
  if (isServe) {
    console.log("Starting development server...");

    // Watch and Serve Mode
    const ctx = await esbuild.context(buildConfig);

    await ctx.watch();
    const { host, port } = await ctx.serve({
      servedir: ".",
      port: 3000,
    });

  } else {
    console.log("Building for production...");
    await esbuild.build(buildConfig);
    console.log("Production build complete.");
  }
})();
