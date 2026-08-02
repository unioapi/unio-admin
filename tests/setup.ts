import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// Node 26 exposes an experimental global localStorage accessor which can shadow
// jsdom's implementation unless a CLI storage file is configured.
const storageValues = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return storageValues.size;
  },
  clear() {
    storageValues.clear();
  },
  getItem(key) {
    return storageValues.get(key) ?? null;
  },
  key(index) {
    return [...storageValues.keys()][index] ?? null;
  },
  removeItem(key) {
    storageValues.delete(key);
  },
  setItem(key, value) {
    storageValues.set(key, String(value));
  },
};
for (const target of [globalThis, window]) {
  Object.defineProperty(target, "localStorage", {
    configurable: true,
    value: memoryStorage,
  });
}

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn(),
});
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  configurable: true,
  value: () => false,
});
Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
  configurable: true,
  value: vi.fn(),
});
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
  configurable: true,
  value: vi.fn(),
});

class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: ResizeObserverStub,
});
