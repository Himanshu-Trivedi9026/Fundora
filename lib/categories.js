/**
 * Single source of truth for project categories.
 * Used by CategorySelector (create form) and SidebarFilters (explore page).
 * The `label` is what gets stored in the Supabase `projects.categories` array.
 */
export const PROJECT_CATEGORIES = [
  { id: "ai", label: "Artificial Intelligence" },
  { id: "tech", label: "Technology & Web3" },
  { id: "creative", label: "Creative Media" },
  { id: "social", label: "Social Impact" },
  { id: "education", label: "Education" },
  { id: "health", label: "Health & Biotech" },
  { id: "environment", label: "Environment & Sustainability" },
  { id: "food", label: "Food & Agriculture" },
  { id: "fashion", label: "Fashion" },
  { id: "gaming", label: "Gaming" },
  { id: "business", label: "Business & Finance" },
];

/** Flat array of labels for easy use in filters */
export const CATEGORY_LABELS = PROJECT_CATEGORIES.map((c) => c.label);
