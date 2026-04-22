import '@testing-library/jest-dom/vitest'

// JSDOM does not implement ResizeObserver or scrollTo.
// Provide minimal stubs so components using them don't throw in tests.
// VirtualGrid uses ResizeObserver to measure its container; in JSDOM
// it will see clientWidth=0 / clientHeight=0 and fall back to rendering
// all items (the "unmeasured" path), which is the correct test behaviour.

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

// Element.scrollTo is not implemented in JSDOM
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {}
}

// JSDOM does not implement window.matchMedia.
// Provide a minimal stub that returns dark preference by default.
// Tests that need to control the value can override it with vi.fn().
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false, // default: dark OS preference
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  } as MediaQueryList)
}

