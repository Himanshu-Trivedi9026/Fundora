import "@testing-library/jest-dom";

// Suppress act() warnings in tests (not relevant for unit tests)
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("Not wrapped in act")) {
    return;
  }
  originalError.call(console, ...args);
};

// Mock window.URL for download tests
if (typeof window !== "undefined") {
  window.URL.createObjectURL = vi.fn(() => "blob:test");
  window.URL.revokeObjectURL = vi.fn();
}

// Mock Next.js router
vi.mock("next/router", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    query: {},
    asPath: "/",
    pathname: "/",
    basePath: "",
    locale: "en",
    locales: ["en"],
    defaultLocale: "en",
    events: {
      on: vi.fn(),
      off: vi.fn(),
    },
  })),
}));

// Mock Next.js Script
vi.mock("next/script", () => ({
  default: ({ children, ...props }) => null,
}));

// Global fetch mock
global.fetch = vi.fn();

// Mock Supabase client (used by components)
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      exchangeCodeForSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    channel: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({}),
    removeChannel: vi.fn(),
  },
}));

// Mock Supabase admin
vi.mock("../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: { id: "test-user-id", email: "test@example.com" },
        },
        error: null,
      }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi
      .fn()
      .mockResolvedValue({ data: { id: "donation-1" }, error: null }),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));
