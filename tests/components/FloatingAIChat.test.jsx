import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FloatingAIChat from "../../components/FloatingAIChat";

vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-token" } },
        error: null,
      }),
    },
  },
}));

import { supabase } from "../../lib/supabaseClient";

describe("FloatingAIChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "test-token" } },
      error: null,
    });
    global.fetch.mockResolvedValue({
      json: vi
        .fn()
        .mockResolvedValue({ reply: "Hello! I can help with funding." }),
    });
  });

  it("renders floating button", () => {
    render(<FloatingAIChat />);

    expect(screen.getByText("💡")).toBeInTheDocument();
  });

  it("opens chat panel when button is clicked", async () => {
    const user = userEvent.setup();
    render(<FloatingAIChat />);

    expect(screen.queryByText("Fundora AI")).not.toBeInTheDocument();

    await user.click(screen.getByText("💡"));

    expect(screen.getByText("🤖 Fundora AI")).toBeInTheDocument();
    expect(screen.getByText("● Online")).toBeInTheDocument();
  });

  it('shows "Ask Fundora AI..." placeholder', async () => {
    const user = userEvent.setup();
    render(<FloatingAIChat />);

    await user.click(screen.getByText("💡"));

    expect(
      screen.getByPlaceholderText("Ask Fundora AI..."),
    ).toBeInTheDocument();
  });

  it("shows empty state message initially", async () => {
    const user = userEvent.setup();
    render(<FloatingAIChat />);

    await user.click(screen.getByText("💡"));

    expect(
      screen.getByText(/Ask about funding, projects, or growth/),
    ).toBeInTheDocument();
  });

  it('shows "Fundora AI" heading', async () => {
    const user = userEvent.setup();
    render(<FloatingAIChat />);

    await user.click(screen.getByText("💡"));

    expect(screen.getByText("🤖 Fundora AI")).toBeInTheDocument();
  });

  it("allows typing and sending messages", async () => {
    const user = userEvent.setup();
    render(<FloatingAIChat />);

    await user.click(screen.getByText("💡"));

    const input = screen.getByPlaceholderText("Ask Fundora AI...");
    await user.type(input, "What is Fundora?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(input).toHaveValue("");
  });

  it("calls API with correct message", async () => {
    const user = userEvent.setup();
    render(<FloatingAIChat />);

    await user.click(screen.getByText("💡"));

    await user.type(
      screen.getByPlaceholderText("Ask Fundora AI..."),
      "Tell me about projects",
    );
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/ai/agent",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          }),
          body: expect.stringContaining("Tell me about projects"),
        }),
      );
    });
  });

  it("shows user message in chat", async () => {
    const user = userEvent.setup();
    render(<FloatingAIChat />);

    await user.click(screen.getByText("💡"));

    await user.type(
      screen.getByPlaceholderText("Ask Fundora AI..."),
      "Hello AI",
    );
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText("Hello AI")).toBeInTheDocument();
    });
  });

  it("shows AI response in chat", async () => {
    const user = userEvent.setup();
    render(<FloatingAIChat />);

    await user.click(screen.getByText("💡"));

    await user.type(
      screen.getByPlaceholderText("Ask Fundora AI..."),
      "Hello AI",
    );
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Hello! I can help with funding."),
      ).toBeInTheDocument();
    });
  });

  it('shows "AI is typing..." during loading', async () => {
    const user = userEvent.setup();
    let resolveFetch;
    global.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(<FloatingAIChat />);

    await user.click(screen.getByText("💡"));

    await user.type(screen.getByPlaceholderText("Ask Fundora AI..."), "Hello");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText("AI is typing...")).toBeInTheDocument();
    });

    resolveFetch({
      json: vi.fn().mockResolvedValue({ reply: "Hi there!" }),
    });

    await waitFor(() => {
      expect(screen.queryByText("AI is typing...")).not.toBeInTheDocument();
    });
  });

  it("Recommend button sends predefined message", async () => {
    const user = userEvent.setup();
    render(<FloatingAIChat />);

    await user.click(screen.getByText("💡"));

    await user.click(screen.getByText("🔥 Recommend"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/ai/agent",
        expect.objectContaining({
          body: expect.stringContaining("Recommend best projects to support"),
        }),
      );
    });
  });

  it("Trending button sends predefined message", async () => {
    const user = userEvent.setup();
    render(<FloatingAIChat />);

    await user.click(screen.getByText("💡"));

    await user.click(screen.getByText("📈 Trending"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/ai/agent",
        expect.objectContaining({
          body: expect.stringContaining("Show trending projects"),
        }),
      );
    });
  });

  it("chat panel closes when button is clicked again", async () => {
    const user = userEvent.setup();
    render(<FloatingAIChat />);

    await user.click(screen.getByText("💡"));
    expect(screen.getByText("🤖 Fundora AI")).toBeInTheDocument();

    await user.click(screen.getByText("💡"));
    expect(screen.queryByText("🤖 Fundora AI")).not.toBeInTheDocument();
  });

  it("shows AI error message on fetch failure", async () => {
    const user = userEvent.setup();
    global.fetch.mockRejectedValue(new Error("Network error"));

    render(<FloatingAIChat />);

    await user.click(screen.getByText("💡"));

    await user.type(screen.getByPlaceholderText("Ask Fundora AI..."), "Hello");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText("⚠️ AI error")).toBeInTheDocument();
    });
  });

  it("does not send empty messages", async () => {
    const user = userEvent.setup();
    render(<FloatingAIChat />);

    await user.click(screen.getByText("💡"));

    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends session token in authorization header", async () => {
    const user = userEvent.setup();
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "my-secret-token" } },
      error: null,
    });

    render(<FloatingAIChat />);
    await user.click(screen.getByText("💡"));

    await user.type(screen.getByPlaceholderText("Ask Fundora AI..."), "Hi");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/ai/agent",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer my-secret-token",
          }),
        }),
      );
    });
  });
});
