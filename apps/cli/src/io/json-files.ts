import { constants } from "node:fs";
import { open, lstat, unlink } from "node:fs/promises";
import { resolve, parse, join } from "node:path";
import { decodeInput, type Envelope } from "@enertally/core";
export const MAX_BYTES = 1024 * 1024;
export function safeText(value: unknown): string {
  return String(value).replace(/[\x00-\x1f\x7f-\x9f]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
// All existing components are checked. Parent replacement races remain possible;
// O_NOFOLLOW and fstat protect the leaf. This is not a directory-fd sandbox.
async function checkedPath(path: string, writing = false) {
  const absolute = resolve(path);
  const root = parse(absolute).root;
  const parts = absolute.slice(root.length).split("/").filter(Boolean);
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = join(current, parts[i]!);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) throw new Error("Symbolic links are not supported");
      if (i < parts.length - 1 && !stat.isDirectory()) throw new Error("Parent must be a directory");
    } catch (error) {
      if (writing && i === parts.length - 1 && (error as NodeJS.ErrnoException).code === "ENOENT") break;
      throw error;
    }
  }
  return absolute;
}
export async function readInput(path: string) {
  const target = await checkedPath(path);
  const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error("Input must be a regular file");
    if (stat.size > MAX_BYTES) throw new Error("Input exceeds 1 MiB");
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await file.read(buffer, total, buffer.length - total, null);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > MAX_BYTES) throw new Error("Input exceeds 1 MiB");
    return decodeInput(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, total))));
  } finally { await file.close(); }
}
export async function writeResult(path: string, result: Envelope) {
  const target = await checkedPath(path, true);
  const file = await open(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  const owned = await file.stat();
  try {
    await file.writeFile(JSON.stringify(result, null, 2) + "\n", "utf8");
    await file.sync();
    await file.close();
  } catch (error) {
    await file.close().catch(() => {});
    const current = await lstat(target).catch(() => undefined);
    if (current?.ino === owned.ino && current?.dev === owned.dev) await unlink(target);
    throw error;
  }
}
