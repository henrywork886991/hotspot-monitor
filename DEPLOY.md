# Deploying the crypto-news backend (hotspot-monitor)

This service is the **data + AI pipeline** behind the iterated BYDFi crypto-news.
It is deployed **separately from** the Java CMS (`zeroex-cms-new`); the bydfi-ssr
frontend reaches it over HTTP via `CRYPTO_NEWS_API_BASE`.

## Architecture (two roles, one image)

```
 worker (CronJob / loop)                api (Deployment, always-on)
   refresh.sh every 2h        shared      uvicorn api.main:app  ── HTTP ──▶  bydfi-ssr
   collect → AI rewrite →  ──▶  data  ◀──  read-only                         (CRYPTO_NEWS_API_BASE)
   translate → images          (DB+JSON)
```

**AI runs only in the worker (offline batch), never on a request.** The API just
reads precomputed rows. Image generation is offline too → uploaded to object
storage → served as a CDN URL. All AI keys live on the **worker** only.

## What you need to prepare

| Thing | Test / beta | Production / scale |
|---|---|---|
| **Database** | **SQLite file** on a shared volume (current; WAL on) | **MySQL / SelectDB(Doris) / Postgres** — matches the CMS's SelectDB (MySQL-protocol, :9030). Port the data layer via `HOTSPOT_DB_PATH`/DSN. |
| Object storage (images) | Cloudinary or Cloudflare R2 bucket + creds | same |
| Compute | Docker host | **k8s** (matches CMS: GitLab CI → k8s) — see `deploy/k8s.yaml` |
| Scheduler | worker loop (`REFRESH_INTERVAL`) | k8s **CronJob** (`schedule: 0 */2 * * *`) |
| Secrets | `.env` | k8s Secret / Nacos |
| Egress | news sources, DeepSeek, image API, R2/Cloudinary, CoinGecko, Binance, bitcoin-data.com | same |
| Reverse proxy / TLS | optional | nginx/caddy or ingress; lock CORS to the SSR origin |

> Note: the existing CMS's "MySQL" is **SelectDB / Apache Doris** on Aliyun
> (`...selectdbfe.rds.aliyuncs.com:9030`) + Redis + Nacos, deployed to k8s via
> GitLab CI. Our service mirrors that **shape** (k8s Deployment + CronJob, env-driven)
> but stays a standalone Python service for maintainability. If BYDFi later wants our
> data in the same store, swap the SQLite layer for a MySQL/Doris DSN — the schema is
> plain SQL.

## Env vars
Copy `.env.example` → `.env` and fill. Worker needs the AI/image keys; the API
needs only `HOTSPOT_DB_PATH` (set by compose/k8s). Frontend sets
`CRYPTO_NEWS_API_BASE=https://<your-api-host>`.

## Local / test (Docker Compose)
```bash
cp .env.example .env        # fill DEEPSEEK_API_KEY etc.
docker compose up -d --build
curl localhost:8900/api/health
curl "localhost:8900/api/cms/public/frontend/hot-news/page?rows=2"
```
- `./data` is bind-mounted so the API serves your existing 80M DB immediately.
- `worker` runs `refresh.sh` every `REFRESH_INTERVAL` (default 7200s).

## Kubernetes (aligns with CMS convention)
`deploy/k8s.yaml`: API `Deployment` + `Service`, worker `CronJob` (every 2h),
shared `PersistentVolumeClaim` (RWX for SQLite). Fill `hotspot-secrets`, set the
image, apply. For an external DB (MySQL/Doris/Postgres) the PVC can be RWO and
you point `HOTSPOT_DB_PATH`/DSN at the DB instead.

## Wiring the frontend
On the bydfi-ssr beta deploy, set:
```
CRYPTO_NEWS_API_BASE=https://<your-api-host>
```
The hot-news pages then render this backend's data; unset → falls back to the
Java CMS (production untouched). See `bydfi-web` branch `ssr/han/crypto-news`.

## Smoke test after deploy
```bash
curl https://<api>/api/health                                   # {"ok":true,...}
curl "https://<api>/api/cms/public/frontend/hot-news/page?rows=1"
curl "https://<api>/api/dip-index"; curl "https://<api>/api/top-index"
```
