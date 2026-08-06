# Plugin Platform

The Fundora Plugin Platform enables third-party developers to extend platform functionality through a secure, sandboxed plugin system.

## Architecture

```
lib/plugins/
├── index.js              # Barrel exports
├── pluginManifest.js     # Manifest schema validation
├── pluginPermissions.js  # Permission system (19 types, risk levels)
├── pluginRegistry.js     # Singleton plugin registry
├── pluginSandbox.js      # Secure execution sandbox
├── pluginLoader.js       # Plugin loading and hook execution
├── pluginLifecycle.js    # State machine (draft → published → archived)
└── pluginEngine.js       # Main orchestrator
```

## Lifecycle States

```
draft → pending_review → approved → published → disabled → archived
                         → rejected (terminal)
```

## Permissions

19 permissions across categories: storage, payment, admin, ai, user, custom. Each has a risk level (LOW, MEDIUM, HIGH, CRITICAL). Plugins requiring HIGH or CRITICAL permissions need admin approval.

## Hooks

12 lifecycle hooks: `before:request`, `after:request`, `before:payment`, `after:payment`, `before:escrow`, `after:escrow`, `on:error`, `on:startup`, `on:shutdown`, `before:auth`, `after:auth`, `on:webhook`.

## Sandboxing

- Execution timeout (default 30s)
- Memory limit (64 MB)
- Restricted global access (no process, require, module, Buffer)
- Permission-gated API access

## API Routes

- `POST /api/plugins/submit` — Submit new plugin
- `GET /api/plugins/list` — List plugins
- `GET /api/plugins/[id]` — Get plugin details
- `PUT /api/plugins/[id]` — Update plugin
- `DELETE /api/plugins/[id]` — Uninstall plugin
