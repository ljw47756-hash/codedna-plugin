import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
export function nowIso() {
    return new Date().toISOString();
}
export function sanitizeFilename(value, fallback = "item") {
    const cleaned = value
        .trim()
        .replace(/[^\p{L}\p{N}_.-]+/gu, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^[-_.]+|[-_.]+$/g, "");
    return (cleaned || fallback).slice(0, 80);
}
export function timestampedName(prefix, suffix) {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    return `${stamp}-${sanitizeFilename(prefix)}${suffix}`;
}
export class JsonStore {
    root;
    constructor(root) {
        this.root = resolve(root);
    }
    path(relativePath) {
        return resolve(this.root, relativePath);
    }
    async ensureDir(relativePath = ".") {
        const target = this.path(relativePath);
        try {
            await mkdir(target, { recursive: true });
            return target;
        }
        catch (error) {
            throw new Error(`Failed to create directory ${target}: ${messageFrom(error)}`);
        }
    }
    async exists(relativePath) {
        try {
            await stat(this.path(relativePath));
            return true;
        }
        catch (error) {
            const nodeError = error;
            if (nodeError.code === "ENOENT") {
                return false;
            }
            throw new Error(`Failed to inspect ${relativePath}: ${messageFrom(error)}`);
        }
    }
    async readJson(relativePath, fallback) {
        const target = this.path(relativePath);
        try {
            const data = await readFile(target, "utf8");
            return JSON.parse(data);
        }
        catch (error) {
            const nodeError = error;
            if (nodeError.code === "ENOENT") {
                return fallback;
            }
            throw new Error(`Failed to read JSON ${target}: ${messageFrom(error)}`);
        }
    }
    async writeJson(relativePath, data) {
        const target = this.path(relativePath);
        try {
            await mkdir(dirname(target), { recursive: true });
            const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
            await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
            await rename(temp, target);
            return target;
        }
        catch (error) {
            throw new Error(`Failed to write JSON ${target}: ${messageFrom(error)}`);
        }
    }
    async appendJsonArray(relativePath, item) {
        const existing = await this.readJson(relativePath, []);
        if (!Array.isArray(existing)) {
            throw new Error(`Cannot append to ${relativePath}: existing JSON value is not an array.`);
        }
        existing.push(item);
        return this.writeJson(relativePath, existing);
    }
    async writeText(relativePath, content) {
        const target = this.path(relativePath);
        try {
            await mkdir(dirname(target), { recursive: true });
            await writeFile(target, `${content.trimEnd()}\n`, "utf8");
            return target;
        }
        catch (error) {
            throw new Error(`Failed to write text ${target}: ${messageFrom(error)}`);
        }
    }
    async readText(relativePath, fallback = "") {
        const target = this.path(relativePath);
        try {
            return await readFile(target, "utf8");
        }
        catch (error) {
            const nodeError = error;
            if (nodeError.code === "ENOENT") {
                return fallback;
            }
            throw new Error(`Failed to read text ${target}: ${messageFrom(error)}`);
        }
    }
    async listJson(relativeDir) {
        const directory = this.path(relativeDir);
        try {
            const entries = await readdir(directory, { withFileTypes: true });
            return entries
                .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
                .map((entry) => join(directory, entry.name))
                .sort();
        }
        catch (error) {
            const nodeError = error;
            if (nodeError.code === "ENOENT") {
                return [];
            }
            throw new Error(`Failed to list JSON files in ${directory}: ${messageFrom(error)}`);
        }
    }
    async listDirectories(relativeDir) {
        const directory = this.path(relativeDir);
        try {
            const entries = await readdir(directory, { withFileTypes: true });
            return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
        }
        catch (error) {
            const nodeError = error;
            if (nodeError.code === "ENOENT") {
                return [];
            }
            throw new Error(`Failed to list directories in ${directory}: ${messageFrom(error)}`);
        }
    }
    async read(relativePath, fallback) {
        return this.readJson(relativePath, fallback);
    }
    async write(relativePath, data) {
        return this.writeJson(relativePath, data);
    }
}
function messageFrom(error) {
    return error instanceof Error ? error.message : String(error);
}
