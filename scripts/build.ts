const targets = [
  { name: "win-x64", target: "bun-windows-x64", ext: ".exe" },
  { name: "darwin-arm64", target: "bun-darwin-arm64", ext: "" },
  { name: "darwin-x64", target: "bun-darwin-x64", ext: "" },
  { name: "linux-x64", target: "bun-linux-x64", ext: "" },
  { name: "linux-arm64", target: "bun-linux-arm64", ext: "" },
]

const outDir = "dist"
const entry = "./src/index.tsx"

await Bun.$`mkdir -p ${outDir}`.quiet()

for (const { name, target, ext } of targets) {
  const out = `${outDir}/spotui-${name}${ext}`
  console.log(`Building ${out} (${target})...`)

  const proc = Bun.spawn([
    "bun",
    "build",
    "--compile",
    `--target=${target}`,
    entry,
    `--outfile=${out}`,
    "--minify",
  ], {
    stdio: ["inherit", "inherit", "inherit"],
  })

  const exit = await proc.exited
  if (exit !== 0) {
    console.error(`Failed to build ${name} (exit code ${String(exit)})`)
    process.exit(exit)
  }
  console.log(`  Done: ${out}`)
}

console.log("\nAll builds complete.")
