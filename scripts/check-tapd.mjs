import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const tapd = join(root, "tapd", "tapd");

function line(label, value) {
  console.log(`${label.padEnd(14)} ${value}`);
}

line("platform", `${process.platform}/${process.arch}`);
line("tapd", existsSync(tapd) ? tapd : "missing");

if (process.platform !== "darwin" || process.arch !== "arm64") {
  console.error("IMU tap detection requires darwin/arm64.");
  process.exitCode = 1;
}

if (!existsSync(tapd)) {
  const go = spawnSync("go", ["version"], { encoding: "utf8" });
  line("go", go.status === 0 ? go.stdout.trim() : "missing");
  console.error("tapd is not built. Run: npm run build:tapd");
  process.exitCode = 1;
} else {
  const mode = statSync(tapd).mode;
  line("executable", mode & 0o111 ? "yes" : "no");
}

const sudo = spawnSync("sudo", ["-n", "true"], { encoding: "utf8" });
line("sudo", sudo.status === 0 ? "cached" : "not cached");
if (sudo.status !== 0) {
  console.error("Run sudo -v before npm run dev, otherwise the app will use Space fallback.");
  process.exitCode = 1;
}
