import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProjectChat from "../../components/ProjectChat";

// --- Hoisted mocks (safe inside vi.mock factory) ---
const m = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockOrder: vi.fn(),
  mockLimit: vi.fn(),
  mockInsert: vi.fn(),
  mockEq: vi.fn(),
  mockGetUser: vi.fn(),
  mockChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockChannelOn: vi.fn(),
  mockChannelSubscribe: vi.fn(),
}));

vi.mock("../../lib/supabaseClient", () => {
  const buildQuery = () => {
    const q = {
      select: m.mockSelect,
      eq: m.mockEq,
      order: m.mockOrder,
      limit: m.mockLimit,
      insert: m.mockInsert,
      single: vi.fn().mockResolvedValue({ data: { owner_id: "owner-1" }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      // Awaiting a mid-chain query resolves to an empty result (supabase-js
      // query builders are thenable; chains are also awaited directly).
      then: (resolve) => resolve({ data: [], error: null }),
    };
    m.mockSelect.mockReturnValue(q);
    m.mockEq.mockReturnValue(q);
    m.mockOrder.mockReturnValue(q);
    m.mockLimit.mockReturnValue(q);
    return q;
  };

  return {
    supabase: {
      auth: { getUser: m.mockGetUser },
      from: vi.fn(() => buildQuery()),
      channel: m.mockChannel,
      removeChannel: m.mockRemoveChannel,
      storage: { from: m.mockStorageFrom },
    },
  };
});

import { supabase } from "../../lib/supabaseClient";

describe("ProjectChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "me@test.com" } }, error: null });
    m.mockSelect.mockResolvedValue({ data: [], error: null });
    m.mockOrder.mockResolvedValue({ data: [], error: null });
    m.mockLimit.mockResolvedValue({ data: [], error: null });

    // Insert default: success
    m.mockInsert.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "real-id-1" }, error: null }),
    }));

    m.mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://x.supabase.co/chat_attachments/proj/file.png" } }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    });

    m.mockChannel.mockReturnValue({
      on: m.mockChannelOn.mockReturnThis(),
      subscribe: m.mockChannelSubscribe.mockImplementation((cb) => cb && cb("SUBSCRIBED")),
      presenceState: vi.fn().mockReturnValue({}),
      track: vi.fn().mockResolvedValue({}),
    });
    m.mockRemoveChannel.mockResolvedValue({});
  });

  it("renders chat UI with input area", async () => {
    render(<ProjectChat projectId="proj-1" />);
    expect(screen.getByText("Project Chat")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument());
  });

  it("sends a message (optimistic row + real id swap)", async () => {
    render(<ProjectChat projectId="proj-1" />);
    await waitFor(() => expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "Hello world" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("Hello world")).toBeInTheDocument();
    });
    expect(m.mockInsert).toHaveBeenCalled();
  });

  it("marks the send as failed when the insert errors", async () => {
    m.mockInsert.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "RLS" } }),
    }));

    render(<ProjectChat projectId="proj-1" />);
    await waitFor(() => expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "will fail" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to send")).toBeInTheDocument();
    });
  });
});
