import type { MemorySnapshot, MemoryStore } from "../storage/memoryStore.js";

export type LoadMemoryOutput = MemorySnapshot;

export async function loadMemory(memoryStore: MemoryStore): Promise<LoadMemoryOutput> {
  return memoryStore.loadSnapshot();
}
