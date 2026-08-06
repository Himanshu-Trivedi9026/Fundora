// Search Platform — barrel exports

export {
  search,
  searchProjects,
  searchUsers,
  searchCampaigns,
  searchPlugins,
  globalSearch,
  getSearchEntities,
} from "./searchEngine.js";

export {
  rebuildIndex,
  listIndexes,
  getIndexStatus,
  queueIndexUpdate,
} from "./searchIndexManager.js";

export {
  getFacets,
  getFacetDefinitions,
  getAllFacetDefinitions,
} from "./facetEngine.js";

export {
  getSuggestions,
  clearSuggestionCache,
  getTrendingSearches,
  SUGGESTION_SOURCES,
} from "./autocompleteEngine.js";

export {
  getSearchAnalytics,
  getZeroResultQueries,
  getSearchPerformance,
} from "./searchAnalytics.js";
