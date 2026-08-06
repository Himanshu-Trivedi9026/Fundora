# Fundora Deployment Guide

## Overview

Fundora supports multiple deployment strategies: Docker Compose for single-server deployments, Kubernetes for production-grade orchestration, and Helm charts for GitOps workflows.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (for containerized deployment)
- kubectl & a Kubernetes cluster (for K8s deployment)
- Helm 3+ (for Helm-based deployment)
- Supabase project (database & auth)
- Redis 7+ (optional, for cache & job queues)

## Quick Start (Docker Compose)

```bash
# 1. Clone and configure
cp deploy/docker/.env.example .env
# Edit .env with your Supabase credentials

# 2. Start all services
docker compose -f deploy/docker/docker-compose.yml up -d

# 3. Verify health
curl http://localhost:3000/api/health
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Fundora App | 3000 | Next.js application |
| Redis | 6379 | Cache & job queue backend |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3001 | Monitoring dashboards |

## Kubernetes Deployment

### Option 1: Raw Manifests

```bash
# Create namespace
kubectl apply -f deploy/k8s/namespace.yml

# Deploy Redis
kubectl apply -f deploy/k8s/redis.yml

# Deploy application
kubectl apply -f deploy/k8s/configmap.yml
kubectl apply -f deploy/k8s/deployment.yml
kubectl apply -f deploy/k8s/service.yml

# Verify deployment
kubectl rollout status deployment/fundora-app -n fundora
```

### Option 2: Helm Chart

```bash
# Install
helm install fundora deploy/helm/fundora \
  --namespace fundora \
  --create-namespace \
  --set secrets.supabaseUrl="https://your-project.supabase.co" \
  --set secrets.supabaseServiceRoleKey="your-key" \
  --set secrets.nextauthSecret="your-secret"

# Upgrade
helm upgrade fundora deploy/helm/fundora \
  --set app.image.tag=v1.2.3

# Rollback
helm rollback fundora 1
```

## Health Probes

The application exposes three types of health probes:

| Probe | Path | Purpose |
|-------|------|---------|
| Liveness | `GET /api/health` | Is the app running? |
| Readiness | `GET /api/health` | Can the app serve traffic? |
| Startup | `GET /api/health` | Has the app fully started? |

Database-specific health: `GET /api/health/database`

## Environment Variables

See `deploy/docker/.env.example` for all configuration options.

### Required

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `NEXTAUTH_SECRET` | NextAuth.js secret key |
| `NEXTAUTH_URL` | Application public URL |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `LOG_LEVEL` | `info` | Logging level |
| `CACHE_BACKEND` | `memory` | Cache backend (`memory`/`redis`/`database`) |
| `ENABLE_TRACING` | `false` | Enable OpenTelemetry tracing |
| `ENABLE_METRICS` | `true` | Enable metrics collection |
| `JOB_CONCURRENCY` | `5` | Max concurrent job workers |

## CI/CD Pipeline

The project includes GitHub Actions workflows:

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `ci.yml` | Push/PR to main | Lint, type-check, test, security scan, build |
| `deploy.yml` | Push to main | Build container, deploy to K8s, smoke test, rollback on failure |
| `preview.yml` | PR opened | Build preview deployment |
| `security.yml` | Weekly/Mon | Dependency audit, SAST, secret scanning |

## Monitoring

- **Metrics**: Available at `GET /api/metrics` (Prometheus format)
- **Health**: Available at `GET /api/health`
- **Diagnostics**: Available at `GET /api/diagnostics`
- **Grafana**: Pre-configured with Prometheus data source (Docker Compose)

## Rollback

### Docker Compose

```bash
docker compose -f deploy/docker/docker-compose.yml down
git checkout <previous-tag>
docker compose -f deploy/docker/docker-compose.yml up -d --build
```

### Kubernetes

```bash
# Automated rollback (via deploy.yml workflow)
kubectl rollout undo deployment/fundora-app -n fundora

# Manual rollback to specific revision
kubectl rollout undo deployment/fundora-app -n fundora --to-revision=3

# Via API
curl -X POST /api/deployments/rollback \
  -H "Content-Type: application/json" \
  -d '{"deploymentId": "dep-xyz"}'
```
