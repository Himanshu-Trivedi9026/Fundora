const DRAFT_KEY = "fundora_create_draft";

/**
 * Save project draft to localStorage.
 * Stores text fields, categories, goal, deadline, prototypeUrl, team.
 * Does NOT store File objects — only filenames.
 */
export function saveDraft(formData, team) {
  const draft = {
    title: formData.title || "",
    short: formData.short || "",
    description: formData.description || "",
    categories: formData.categories || [],
    goal: formData.goal || "",
    deadline: formData.deadline || "",
    duration: formData.duration || null,
    prototypeUrl: formData.prototypeUrl || "",
    team: team || [],
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

/**
 * Load project draft from localStorage.
 * Returns null if no draft exists.
 */
export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clear the saved draft from localStorage.
 */
export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

/**
 * Check if a draft exists.
 */
export function hasDraft() {
  return localStorage.getItem(DRAFT_KEY) !== null;
}
