# Marketplace

The Fundora Marketplace is a plugin distribution platform where developers publish and users discover plugins.

## Architecture

```
lib/marketplace/
├── index.js                # Barrel exports
└── marketplaceEngine.js    # Core marketplace operations
```

## Features

- **Plugin Publishing**: Submit plugins for public listing
- **Search & Discovery**: Full-text search, category filtering, sort by rating/downloads
- **Reviews & Ratings**: 5-star rating system with duplicate prevention
- **Featured Plugins**: Curated plugin showcases
- **Developer Verification**: Auto-verify developers with 3+ published plugins
- **Pagination**: Offset-based pagination for browse results

## API Routes

- `GET /api/marketplace/list` — Browse marketplace plugins
- `POST /api/marketplace/review` — Submit plugin review
- `GET /api/marketplace/featured` — Get featured plugins

## Developer Portal

- `POST /api/developer/register` — Register as developer
- `GET /api/developer/my-plugins` — List developer's plugins
- `/developer` — Developer dashboard page
