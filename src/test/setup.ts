import "@testing-library/jest-dom";

// Guard for node-environment test files (e.g. the OCR smoke) where there is no
// `window`; the jsdom matchMedia shim only applies when a DOM is present.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
