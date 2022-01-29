const argv = require("minimist")(process.argv.slice(2));

require("esbuild")
  .build({
    entryPoints: ["src/vase.ts"],
    bundle: true,
    sourcemap: true,
    watch: argv.watch && {
      onRebuild(error, result) {
        if (error) console.error("build failed:", error);
        else console.log("build successs");
      },
    },
    format: "esm",
    outdir: "dist",
    minify: process.env.NODE_ENV === "production",
    define: {
      "process.env.NODE_ENV": `"${process.env.NODE_ENV}"`,
    },
    loader: {
      ".html": "text",
    },
  })
  .then(() => {
    argv.watch && console.log("Watching folder changes...");
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
