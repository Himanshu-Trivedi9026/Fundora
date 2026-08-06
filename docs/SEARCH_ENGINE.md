# Search Platform

Unified search across all Fundora entities with faceting, autocomplete, and analytics.

## Architecture

```
lib/search/
├── index.js                # Barrel exports
├── searchEngine.js         # Full-text search, filtering, pagination
├── searchIndexManager.js   # Index rebuild and maintenance
├── facetEngine.js          # Term and range faceting
├── autocompleteEngine.js   # Suggestion and type-ahead
└── searchAnalytics.js      # Query analytics and insights
```

## Search Engine

- **Entities**: projects, users, campaigns, plugins
- **Multi-field Search**: Searches across title, description, tags
- **Filters**: Exact match, range, array inclusion
- **Sorting**: Any field, ascending/descending
- **Pagination**: Offset-based with total count
- **Global Search**: Cross-entity search with per-entity limits

## Facet Engine

- **Term Facets**: Category, status, pricing model
- **Range Facets**: Funding goal brackets ($5K, $25K, $100K+)
- **Dynamic Computation**: Counts computed at query time

## Autocomplete

- **Sources**: popular, recent, trending (weighted scoring)
- **Cache**: Per-source TTL (10min–1hr)
- **Deduplication**: Combined scoring with dedup

## Search Analytics

- Zero-result query tracking
- Entity type breakdown
- Query frequency analysis
- Daily performance metrics

## API Routes

- `GET/POST /api/search` — Search and advanced search
- `GET /api/search/autocomplete` — Autocomplete suggestions
