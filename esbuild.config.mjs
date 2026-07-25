import * as esbuild from "esbuild";
import { exec } from "child_process";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);
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

/** Packages that may be missing from older Acode hosts and need a bundled copy. */
const lezerFallbackPackages = new Set(["@lezer/lr", "@lezer/common"]);

/** Prefer the ESM build so nested named imports are checked and stay consistent. */
function resolveEsmEntry(pkg) {
  const cjsEntry = require.resolve(pkg);
  if (cjsEntry.endsWith(`${path.sep}index.cjs`)) {
    return cjsEntry.slice(0, -"index.cjs".length) + "index.js";
  }
  if (cjsEntry.endsWith(".cjs")) {
    return cjsEntry.slice(0, -4) + ".js";
  }
  return cjsEntry;
}

const acodeRuntimePlugin = {
  name: "acode-runtime",
  setup(build) {
    build.onResolve({ filter: /^(@codemirror|@lezer)\// }, (args) => {
      // Runtime shims import real @lezer packages as a fallback. Resolve those
      // (and their nested @lezer/* deps) to the real ESM builds so the graph is
      // self-contained. Everything else goes through the shims so language code
      // shares one host-or-fallback instance.
      const useBundledFallback =
        args.pluginData?.bundleNative ||
        (args.importer &&
          /(?:^|[/\\])src[/\\]runtime[/\\]/.test(args.importer) &&
          lezerFallbackPackages.has(args.path));

      if (useBundledFallback && lezerFallbackPackages.has(args.path)) {
        return {
          path: resolveEsmEntry(args.path),
          pluginData: { bundleNative: true },
        };
      }

      // Nested deps of the fallback packages that are not themselves
      // lezerFallbackPackages (none today) fall through to normal resolution.
      if (useBundledFallback) {
        return {
          path: require.resolve(args.path),
          pluginData: { bundleNative: true },
        };
      }

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
