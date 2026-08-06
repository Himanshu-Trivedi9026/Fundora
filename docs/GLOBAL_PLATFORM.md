# Global Platform

The global platform infrastructure enables Fundora to operate as a worldwide SaaS crowdfunding platform.

## Components

### Internationalization (i18n)

- **20 Locales**: en, hi, bn, ta, te, mr, gu, kn, ml, pa, ur, or, as, mai, sat, ks, ne, sd, fr, es
- **RTL Support**: ur, ar (built-in text direction detection)
- **Translation Service**: DB-backed with 5-min cache, parameter interpolation
- **Format Helpers**: Numbers, dates, currencies, relative time (Intl-based)
- **Locale Resolution**: Accept-Language header parsing with q-values
- **API**: `GET/POST /api/i18n/translations`

### Multi-Currency

- **10 Currencies**: INR, USD, EUR, GBP, JPY, AUD, CAD, SGD, AED, CHF
- **Exchange Rates**: DB storage with 5-min cache
- **Conversion**: Automatic reverse rate fallback, decimal precision
- **History**: Historical rate queries
- **API**: `GET/POST /api/currency/rates`, `GET /api/currency/convert`

### Global Payment Providers

- **7 Providers**: Stripe (2.5%), PayPal (2.9%+$0.30), Wise (0.5% min $0.50), Adyen (1.8%), Razorpay (2%), Cashfree (1.5%), Mock (testing)
- **Base Provider Contract**: processPayment, verifyPayment, refundPayment, getBalance, validateWebhook, processPayout
- **Registry Pattern**: Register, activate, list providers
- **Per-Provider Config**: Supported currencies and countries

### Backup & Recovery

- **Backup Engine**: Create, list, delete backups with status lifecycle
- **Snapshot Engine**: Point-in-time recovery points
- **Restore Engine**: Initiate, validate, verify, rollback restore operations
- **Retention Engine**: Policy-based auto-cleanup (daily/weekly/monthly/yearly)
- **API**: `GET/POST/DELETE /api/backup/backups`, `GET/POST /api/backup/restore`

### CDN & Storage Abstraction

- **4 Providers**: Local, S3-compatible, GCS, Supabase Storage
- **Storage Adapter**: Unified upload/download/delete/list interface
- **Signed URLs**: Time-limited access (read: 7d max, upload: 1d max)
- **Image Optimizer**: Resize, format conversion, compression, srcset generation
- **API**: `POST /api/storage/upload`, `GET /api/storage/signed-url`

### Mobile API & API Extensions

- **Pagination Engine**: Cursor-based and offset-based pagination
- **Offline Sync**: Change tracking, conflict resolution (4 strategies), batch operations
- **Response Optimizer**: Field selection, null stripping, sparse fieldsets
- **Versioned API**: Version registration, header parsing, deprecation management
- **API**: `GET/POST /api/mobile/sync`

## Database Tables (24 new)

plugins, plugin_versions, plugin_reviews, plugin_downloads, marketplace_categories, language_packs, translation_entries, currencies, exchange_rates, metrics, alerts, alert_events, health_checks, traces, backup_policies, backups, recovery_points, restore_operations, search_indexes, search_analytics, storage_providers, storage_objects, api_versions, api_rate_limits

## Admin Dashboards

| Page             | Route                   | Component                |
| ---------------- | ----------------------- | ------------------------ |
| Marketplace      | `/admin/marketplace`    | MarketplaceDashboard     |
| Plugin Manager   | `/admin/plugins`        | PluginManager            |
| Observability    | `/admin/observability`  | ObservabilityDashboard   |
| Infrastructure   | `/admin/infrastructure` | InfrastructureDashboard  |
| Analytics        | `/admin/analytics`      | GlobalAnalyticsDashboard |
| Developer Portal | `/developer`            | DeveloperPortal          |
