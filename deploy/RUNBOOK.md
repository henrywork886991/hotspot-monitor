# Crypto News 後端服務 — 部署手冊（運維用）

> 對象：DevOps / 運維。本服務是 BYDFi crypto-news 的**資料 + AI 內容管線**，
> 與既有 Java CMS（`zeroex-cms-new`）**獨立部署**，前端（bydfi-ssr）以 HTTP 連接。
> 技術棧：Python 3.13 / FastAPI。容器化，支援 Docker Compose（測試）與 Kubernetes（正式）。

---

## 1. 服務概觀

```
          ┌─────────────────────────────────────────────┐
          │  hotspot-monitor (單一映像，兩種角色)          │
          │                                             │
  排程 ──▶ │  worker：每 2h 跑 pipeline                   │
          │    採集新聞 → AI 改寫/翻譯 → 生成封面圖         │──▶ 物件儲存(圖片)
          │    結果寫入 DB ──────────────┐               │
          │                             ▼               │
          │  api：常駐、唯讀 uvicorn  ◀── DB(+JSON)        │──HTTP──▶ bydfi-ssr 前端
          └─────────────────────────────────────────────┘            (CRYPTO_NEWS_API_BASE)
```

- **api**：常駐 HTTP 服務，唯讀，毫秒級回應。**不呼叫任何 AI。**
- **worker**：定時批次。所有 AI/外部金鑰**只在這裡**。
- 兩者**共用同一份資料**（DB + JSON 檔；圖片在物件儲存）。

---

## 2. 元件與資源需求

| 元件 | 角色 | 建議資源 | 對外埠 | 備註 |
|---|---|---|---|---|
| `api` | Deployment / 常駐 | 0.25 vCPU / 512Mi（可水平擴展，唯讀） | **8900** | 健康檢查 `/api/health` |
| `worker` | CronJob / 定時 | 0.5 vCPU / 1Gi（執行時尖峰，網路為主） | 無 | 每 2h 一次，**不可重疊** |
| 資料儲存 | PVC / Volume | 5Gi（DB 現約 80MB，逐步成長） | — | 測試用 SQLite；正式可換 DB |
| 物件儲存 | Cloudinary / R2 | — | — | 封面圖 |

---

## 3. 前置準備（部署前確認）

- [ ] **容器映像倉庫**（registry）可推送/拉取
- [ ] **執行環境**：Docker 主機（測試）或 Kubernetes 叢集（正式）
- [ ] **資料庫決策**：測試 = SQLite（隨 PVC）；正式 = MySQL / SelectDB(Doris) / PostgreSQL（見 §7）
- [ ] **物件儲存**：Cloudinary 或 R2 bucket + 金鑰
- [ ] **機密**：AI 金鑰等（見 §5），放 k8s Secret 或 Nacos
- [ ] **對外網路（egress）白名單**（worker 需要）：
  - 新聞來源 RSS/網站（多網域）
  - `api.deepseek.com`（AI 改寫）
  - 圖片生成 API host、`api.cloudinary.com` 或 R2 endpoint
  - `api.coingecko.com`、`fapi.binance.com`、`bitcoin-data.com`
- [ ] **入口/網域 + TLS**：給 api 一個對外網址（ingress / nginx），供前端連
- [ ] **前端**：bydfi-ssr beta 環境可設環境變數 `CRYPTO_NEWS_API_BASE`

---

## 4. 建置映像

```bash
# 於專案根目錄
docker build -t <REGISTRY>/hotspot-monitor:<TAG> .
docker push <REGISTRY>/hotspot-monitor:<TAG>
```
> 同一個映像跑三種角色，由啟動參數決定：`api`（預設）/ `worker` / `once`。
> 若用 GitLab CI，可比照既有 `java-build-image` 流程改成 docker build/push（本服務非 Java）。

---

## 5. 設定（環境變數）

放入 `.env`（Compose）或 k8s Secret。**api 幾乎不需金鑰；worker 需要全部 AI/儲存金鑰。**

| 變數 | 必填 | 用於 | 說明 |
|---|---|---|---|
| `HOTSPOT_DB_PATH` | ✅ | api+worker | DB 路徑，容器內固定 `/app/data/hotspots.db` |
| `DEEPSEEK_API_KEY` | ✅(worker) | worker | AI 改寫/摘要/翻譯 |
| `DEEPSEEK_API_BASE` | | worker | 預設 `https://api.deepseek.com/v1` |
| `DEEPSEEK_MODEL` | | worker | 預設 `deepseek-chat` |
| `REWRITE_LANG` | | worker | 統一輸出語言，預設 `zh-Hant` |
| `IMAGE_API_KEY` / `IMAGE_API_BASE` / `IMAGE_MODEL` | (生圖才需) | worker | 封面圖生成 |
| `CLOUDINARY_URL` / `CLOUDINARY_FOLDER` 或 `R2_*` | (生圖才需) | worker | 圖片儲存 |
| `REFRESH_INTERVAL` | | worker | 迴圈間隔秒數，預設 `7200`（Compose 用；k8s 用 CronJob schedule） |
| `PORT` | | api | 預設 `8900` |

> 完整清單見 `.env.example`。**金鑰請走 Secret，勿入 git。**

---

## 6. 部署方式 A — Docker Compose（測試 / 單機）

```bash
cp .env.example .env          # 填入金鑰
docker compose up -d --build  # 起 api + worker
docker compose ps
curl http://localhost:8900/api/health        # → {"ok":true,...}
```
- `api` 對外 8900；`worker` 背景每 2h 跑一次。
- 資料存在 compose volume（預設 bind `./data`，可改 named volume）。
- 查日誌：`docker compose logs -f worker` / `... api`。

---

## 7. 部署方式 B — Kubernetes（正式，對齊現有 k8s 慣例）

清單見 `deploy/k8s.yaml`：`Deployment(api)` + `Service` + `CronJob(worker, 每 2h)` + `PVC` + `Secret`。

```bash
# 1) 填好 Secret 的金鑰、替換映像位址 <REGISTRY>/<IMAGE>:<TAG>
# 2) 套用
kubectl apply -f deploy/k8s.yaml
kubectl rollout status deploy/hotspot-api
kubectl get cronjob hotspot-worker
# 3) 首次初始化：手動觸發一次 worker 把資料灌進來
kubectl create job --from=cronjob/hotspot-worker hotspot-worker-init
kubectl logs -f job/hotspot-worker-init
```
重點：
- **PVC**：SQLite 需 api 與 cronjob 共掛 → `ReadWriteMany`。若改用外部 DB（§8），PVC 可用 `ReadWriteOnce` 或不需要。
- **CronJob**：`schedule: 0 */2 * * *`、`concurrencyPolicy: Forbid`（不重疊）。
- **Service/Ingress**：把 `hotspot-api` Service 接上 ingress + TLS，得到對外網址。
- 機密走 `Secret`（或接 Nacos，與 CMS 一致）。

---

## 8. 資料庫

| 階段 | 方案 | 做法 |
|---|---|---|
| 測試/beta | **SQLite**（現況） | 隨 PVC/volume；首次跑一次 worker 即建表灌資料；已開 WAL |
| 正式/規模化 | **MySQL / SelectDB(Doris) / PostgreSQL** | 與 CMS 同套 SelectDB 亦可；把資料層接 DSN（schema 為標準 SQL，少量 SQLite 方言需轉） |

- **初始化**：服務首次啟動會自動建表（`save_to_db.py` 等內含 `CREATE TABLE IF NOT EXISTS`）。
- **種子資料**：可將開發環境的 `data/hotspots.db`（約 80MB）複製進 PVC，前端立即有內容；或讓 worker 跑數輪自然累積。
- **備份**：SQLite → 定期快照 PVC / 複製 `.db`；外部 DB → 走該 DB 既有備份機制。

---

## 9. 物件儲存（封面圖）
worker 生成圖片後上傳 Cloudinary 或 R2，DB 只存 URL，前端當靜態 CDN 圖載入。準備一個 bucket + 金鑰，填入對應環境變數即可。

---

## 10. 對外網路 / 安全
- **api** 經 ingress/反向代理對外，建議加 TLS。
- **CORS**：預設放行全部；正式請收斂到前端來源網域（改 `api/main.py` 的 `allow_origins`）。
- api 唯讀、無寫入端點，攻擊面小；金鑰全在 worker（不對外）。

---

## 11. 健康檢查 / 觀測
- **就緒/存活**：`GET /api/health` → `{"ok":true,"rows":<DB 筆數>}`。
- **日誌**：兩個角色都輸出 stdout（k8s/Compose 直接收）。worker 每輪印開始/結束/各步驟筆數。
- **告警建議**：api `/api/health` 非 200；worker CronJob 連續失敗；DB 筆數長時間不成長（代表採集/AI 卡住）。

---

## 12. 前端接線（bydfi-ssr）
在前端 beta 部署設環境變數：
```
CRYPTO_NEWS_API_BASE = https://<api 對外網址>
```
設了 → crypto-news 頁吃本服務資料；不設 → 維持既有 Java CMS（production 不受影響）。

---

## 13. 部署後驗收（smoke test）
```bash
API=https://<api 對外網址>
curl -fsS  $API/api/health
curl -fsS "$API/api/cms/public/frontend/hot-news/page?rows=2"   # 既有前端契約
curl -fsS  $API/api/dip-index ; curl -fsS $API/api/top-index     # 差異化指標
```
全部 200 即可。再到前端開 `/<locale>/crypto-news` 確認渲染。

---

## 14. 升級 / 回滾
- 升級：建新 tag → `kubectl set image deploy/hotspot-api api=<...:newtag>`（或改 manifest 重 apply）。
- 回滾：`kubectl rollout undo deploy/hotspot-api`。
- worker 為無狀態批次，更新映像即下次排程生效。
- **前端切換/回退**：增刪 `CRYPTO_NEWS_API_BASE` 即可在「我們後端 / Java CMS」間切換，零程式改動。

---

## 15. 常見問題
| 症狀 | 可能原因 | 處置 |
|---|---|---|
| `/api/health` 200 但 `rows` 為 0 | 尚未跑過 worker | 手動觸發一次 worker（§7）|
| worker 報 AI 失敗 | 金鑰未設 / egress 被擋 | 檢查 Secret 與 egress 白名單（§3）|
| 前端 crypto-news 仍是舊資料 | `CRYPTO_NEWS_API_BASE` 未設或不可達 | 檢查前端環境變數與網路連通 |
| api 讀不到資料 | PVC 未共掛 / 非 RWX | 確認 api 與 worker 掛同一 PVC（SQLite 需 RWX）|
