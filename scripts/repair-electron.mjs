import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { get } from "node:https";
import { basename, dirname, join, resolve } from "node:path";
import extract from "extract-zip";

const root = resolve(new URL("..", import.meta.url).pathname);
const electronRoot = join(root, "node_modules", "electron");
const electronPackage = JSON.parse(readFileSync(join(electronRoot, "package.json"), "utf8"));
const version = electronPackage.version;
const platform = process.env.npm_config_platform || process.platform;
const arch = process.env.npm_config_arch || process.arch;
const artifact = `electron-v${version}-${platform}-${arch}.zip`;
const mirror = process.env.ELECTRON_MIRROR || "https://npmmirror.com/mirrors/electron/";
const url = new URL(`${version}/${artifact}`, mirror).toString();
const zipPath = join(electronRoot, ".npm-cache", artifact);
const distPath = join(electronRoot, "dist");

if (platform !== "darwin" || !["arm64", "x64"].includes(arch)) {
  throw new Error(`Unsupported repair target: ${platform}/${arch}`);
}

mkdirSync(dirname(zipPath), { recursive: true });

if (!existsSync(zipPath)) {
  await download(url, zipPath);
}

verifyChecksum(zipPath, artifact);
rmSync(distPath, { recursive: true, force: true });
mkdirSync(distPath, { recursive: true });
await extract(zipPath, { dir: distPath });
writeFileSync(join(electronRoot, "path.txt"), "Electron.app/Contents/MacOS/Electron");
console.log(`Electron ${version} repaired at ${join(distPath, "Electron.app")}`);

function verifyChecksum(filePath, fileName) {
  const sums = readFileSync(join(electronRoot, "SHASUMS256.txt"), "utf8");
  const line = sums
    .split("\n")
    .find((candidate) => candidate.includes(fileName));

  if (!line) {
    throw new Error(`Checksum entry missing for ${fileName}`);
  }

  const expected = line.split(/\s+/)[0];
  const actual = createHash("sha256").update(readFileSync(filePath)).digest("hex");
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${basename(filePath)}.`);
  }
}

function download(source, target, redirects = 0) {
  return new Promise((resolveDownload, reject) => {
    const request = get(source, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        if (redirects > 5) {
          reject(new Error("Too many redirects while downloading Electron."));
          return;
        }
        resolveDownload(download(new URL(response.headers.location, source).toString(), target, redirects + 1));
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed with HTTP ${response.statusCode}.`));
        return;
      }

      const total = Number(response.headers["content-length"] ?? 0);
      let received = 0;
      const output = createWriteStream(target);
      response.on("data", (chunk) => {
        received += chunk.length;
        if (total > 0) {
          const pct = Math.floor((received / total) * 100);
          if (pct % 10 === 0) {
            process.stdout.write(`\rDownloading Electron ${pct}%`);
          }
        }
      });
      response.pipe(output);
      output.on("finish", () => {
        output.close(() => {
          process.stdout.write("\n");
          resolveDownload();
        });
      });
      output.on("error", reject);
    });

    request.setTimeout(300_000, () => {
      request.destroy(new Error("Electron download timed out."));
    });
    request.on("error", reject);
  });
}
