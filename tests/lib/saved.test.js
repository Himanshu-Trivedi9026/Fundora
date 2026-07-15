import { vi } from "vitest";

// saved.js is pure localStorage logic — test it directly
import { getSaved, isSaved, getSaveCounts, toggleSave } from "@/lib/saved";

describe("lib/saved.js — localStorage bookmarks", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ---- getSaved ----
  it("returns empty array when nothing saved", () => {
    expect(getSaved()).toEqual([]);
  });

  it("returns saved list from localStorage", () => {
    localStorage.setItem("savedProjects", JSON.stringify(["p1", "p2"]));
    expect(getSaved()).toEqual(["p1", "p2"]);
  });

  // ---- isSaved ----
  it("returns true when project is saved", () => {
    localStorage.setItem("savedProjects", JSON.stringify(["p1"]));
    expect(isSaved("p1")).toBe(true);
  });

  it("returns false when project is not saved", () => {
    expect(isSaved("p1")).toBe(false);
  });

  // ---- getSaveCounts ----
  it("returns empty object when no counts", () => {
    expect(getSaveCounts()).toEqual({});
  });

  it("returns counts from localStorage", () => {
    localStorage.setItem("saveCounts", JSON.stringify({ p1: 5, p2: 2 }));
    expect(getSaveCounts()).toEqual({ p1: 5, p2: 2 });
  });

  // ---- toggleSave ----
  it("adds project to saved list", () => {
    const result = toggleSave("p1");
    expect(result).toBe(true);
    expect(getSaved()).toEqual(["p1"]);
  });

  it("removes project from saved list", () => {
    localStorage.setItem("savedProjects", JSON.stringify(["p1", "p2"]));
    toggleSave("p1");
    expect(getSaved()).toEqual(["p2"]);
  });

  it("increments count when saving", () => {
    toggleSave("p1");
    expect(getSaveCounts()).toEqual({ p1: 1 });
  });

  it("decrements count when unsaving", () => {
    localStorage.setItem("savedProjects", JSON.stringify(["p1"]));
    localStorage.setItem("saveCounts", JSON.stringify({ p1: 3 }));
    toggleSave("p1");
    expect(getSaveCounts()).toEqual({ p1: 2 });
  });

  it("does not go below 0 when decrementing count", () => {
    localStorage.setItem("savedProjects", JSON.stringify(["p1"]));
    localStorage.setItem("saveCounts", JSON.stringify({ p1: 0 }));
    toggleSave("p1");
    expect(getSaveCounts()).toEqual({ p1: 0 });
  });

  it("toggles save state correctly over multiple calls", () => {
    toggleSave("p1"); // save
    expect(getSaved()).toEqual(["p1"]);
    expect(isSaved("p1")).toBe(true);

    toggleSave("p1"); // unsave
    expect(getSaved()).toEqual([]);
    expect(isSaved("p1")).toBe(false);

    toggleSave("p1"); // save again
    expect(getSaved()).toEqual(["p1"]);
    expect(isSaved("p1")).toBe(true);
  });

  it("handles multiple projects independently", () => {
    toggleSave("p1");
    toggleSave("p2");
    toggleSave("p3");

    expect(getSaved()).toEqual(["p1", "p2", "p3"]);
    expect(getSaveCounts()).toEqual({ p1: 1, p2: 1, p3: 1 });

    toggleSave("p2");
    expect(getSaved()).toEqual(["p1", "p3"]);
    expect(getSaveCounts()).toEqual({ p1: 1, p2: 0, p3: 1 });
  });
});
