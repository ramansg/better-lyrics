import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const rootDir = process.cwd();
const packageJsonPath = join(rootDir, "package.json");
const manifestPath = join(rootDir, "manifest.json");
const optionsHtmlPath = join(rootDir, "src", "options", "options.html");

try {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  let version = packageJson.version;

  if (process.argv[2]) {
    version = process.argv[2];
    console.log(`Using provided version: ${version}`);
    packageJson.version = version;
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4) + "\n");
  }

  if (!version) {
    throw new Error("Version not found in package.json");
  }

  console.log(`Bumping version to ${version}`);

  // Update manifest.json
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  manifest.version = version;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  // Update src/options/options.html
  let optionsHtml = readFileSync(optionsHtmlPath, "utf-8");
  optionsHtml = optionsHtml.replace(/v[0-9]*\.[0-9]*\.[0-9]*/, `v${version}`);
  writeFileSync(optionsHtmlPath, optionsHtml);

  // Run biome
  console.log("Running biome...");
  execSync("npx @biomejs/biome lint --fix");
  execSync("npx @biomejs/biome format --fix");

  console.log("Version bump complete.");
} catch (error) {
  console.error("Error bumping version:", error);
  process.exit(1);
}
