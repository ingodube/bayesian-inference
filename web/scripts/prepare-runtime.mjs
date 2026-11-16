import {
  cp,
  mkdir,
  readdir,
  stat,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/webr/dist");
const target = resolve(root, "public/vendor/webr");
await mkdir(target, { recursive: true });
const files = (await readdir(source)).filter((n) =>
  /\.(wasm|data|js|mjs|so)$/.test(n),
);
const hashes = {};
for (const file of files) {
  await cp(resolve(source, file), resolve(target, file));
  hashes[file] = {
    bytes: (await stat(resolve(target, file))).size,
    sha256: createHash("sha256")
      .update(await readFile(resolve(target, file)))
      .digest("hex"),
  };
}
await cp(
  resolve(root, "node_modules/webr/LICENSE.md"),
  resolve(target, "LICENSE.md"),
);
await cp(resolve(source, "vfs"), resolve(target, "vfs"), { recursive: true });
await writeFile(
  resolve(target, "integrity.json"),
  JSON.stringify(hashes, null, 2),
);
console.log("Self-hosted webR runtime:", files.join(", "));
