import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export function nowIso(): string {
  return new Date().toISOString();
}

export function sanitizeFilename(value: string, fallback = "item"): string {
  const cleaned = value
    .trim()
    .replace(/[^\p{L}\p{N}_.-]+/gu, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return (cleaned || fallback).slice(0, 80);
}

export function timestampedName(prefix: string, suffix: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${stamp}-${sanitizeFilename(prefix)}${suffix}`;
}

export class JsonStore {
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  path(relativePath: string): string {
    return resolve(this.root, relativePath);
  }

  async ensureDir(relativePath = "."): Promise<string> {
    const target = this.path(relativePath);
    try {
      await mkdir(target, { recursive: true });
      return target;
    } catch (error) {
      throw new Error(`Failed to create directory ${target}: ${messageFrom(error)}`);
    }
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await stat(this.path(relativePath));
      return true;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return false;
      }
      throw new Error(`Failed to inspect ${relativePath}: ${messageFrom(error)}`);
    }
  }

  async readJson<T>(relativePath: string, fallback: T): Promise<T> {
    const target = this.path(relativePath);
    try {
      const data = await readFile(target, "utf8");
      return JSON.parse(data) as T;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return fallback;
      }
      throw new Error(`Failed to read JSON ${target}: ${messageFrom(error)}`);
    }
  }

  async writeJson(relativePath: string, data: unknown): Promise<string> {
    const target = this.path(relativePath);
    try {
      await mkdir(dirname(target), { recursive: true });
      const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      await rename(temp, target);
      return target;
    } catch (error) {
      throw new Error(`Failed to write JSON ${target}: ${messageFrom(error)}`);
    }
  }

  async appendJsonArray(relativePath: string, item: unknown): Promise<string> {
    const existing = await this.readJson<unknown[]>(relativePath, []);
    if (!Array.isArray(existing)) {
      throw new Error(`Cannot append to ${relativePath}: existing JSON value is not an array.`);
    }
    existing.push(item);
    return this.writeJson(relativePath, existing);
  }

  async writeText(relativePath: string, content: string): Promise<string> {
    const target = this.path(relativePath);
    try {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, `${content.trimEnd()}\n`, "utf8");
      return target;
    } catch (error) {
      throw new Error(`Failed to write text ${target}: ${messageFrom(error)}`);
    }
  }

  async readText(relativePath: string, fallback = ""): Promise<string> {
    const target = this.path(relativePath);
    try {
      return await readFile(target, "utf8");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return fallback;
      }
      throw new Error(`Failed to read text ${target}: ${messageFrom(error)}`);
    }
  }

  async listJson(relativeDir: string): Promise<string[]> {
    const directory = this.path(relativeDir);
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => join(directory, entry.name))
        .sort();
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return [];
      }
      throw new Error(`Failed to list JSON files in ${directory}: ${messageFrom(error)}`);
    }
  }

  async listDirectories(relativeDir: string): Promise<string[]> {
    const directory = this.path(relativeDir);
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return [];
      }
      throw new Error(`Failed to list directories in ${directory}: ${messageFrom(error)}`);
    }
  }

  async read<T>(relativePath: string, fallback: T): Promise<T> {
    return this.readJson(relativePath, fallback);
  }

  async write(relativePath: string, data: unknown): Promise<string> {
    return this.writeJson(relativePath, data);
  }
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
