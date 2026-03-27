# World Bank データ取得 AIエージェント — 実装計画 v2

## 目的

「イラン戦争の経済的影響を調べたい」のような**抽象的・テーマ的な指示**から、AIエージェントが自律的に：

1. 分析に必要な国・指標・期間を**設計**する
2. World Bank API からデータを**取得**する
3. CSVファイルを `out/` に**出力**する
4. チャート付きHTMLを `site/` に**可視化**する

---

## 設計方針

- 既存のデータカタログCLI (`src/agent.ts`) のアーキテクチャを踏襲
- **Claude API + tool use ループ** でエージェントが自律的にツールを呼び分ける
- **分析設計フェーズ**をエージェントの行動指針に組み込み、「何を取るべきか」の判断をAIに委ねる
- **既存コードの整理**: WB専用ツールへの転換に伴い、使い回せない既存コード・データは積極的に削除する。エントリポイントも `wb-cli.ts` に一本化し、旧カタログCLI関連は撤去する

### 削除対象

既存のデータカタログ機能は WB データ取得ツールとは目的が異なるため、以下を削除する:

| 削除対象 | 理由 |
|----------|------|
| `src/index.ts` | 旧カタログCLI エントリポイント。`wb-cli.ts` に置き換え |
| `src/agent.ts` | 旧エージェントコア。`wb-agent.ts` に置き換え |
| `src/catalog.ts` | YAML/SQLite デュアルストレージ。WBツールでは不使用 |
| `src/db.ts` | SQLite初期化/FTS5。WBツールでは不使用 |
| `src/build-catalog.ts` | YAML→SQLite再構築スクリプト。不要 |
| `src/build-site.ts` | 旧サイトビルド。`build-chart-site.ts` に置き換え |
| `src/tools/search-catalog.ts` | カタログ検索。不要 |
| `src/tools/web-search.ts` | Google検索。WBツールでは不使用 |
| `src/tools/fetch-page.ts` | ページ取得。WBツールでは不使用 |
| `src/tools/register.ts` | カタログ登録。不要 |
| `src/tools/catalog-stats.ts` | カタログ統計。不要 |
| `src/tools/get-source-detail.ts` | ソース詳細。不要 |
| `src/tools/save-report.ts` | レポート出力。不要 |
| `src/types.ts` | 旧カタログ型定義。WB用の型は `wb-api.ts` に統合 |
| `sources/` | YAMLマスターデータ一式。WBツールでは不使用 |
| `site/app.js`, `site/style.css`, `site/index.html` | 旧カタログビューア。`build-chart-site.ts` で再生成 |
| `tests/` | 旧テスト。WB用テストに書き直し |
| `catalog.db` | SQLiteインデックス。不要 |

### 残すもの

| 残す対象 | 理由 |
|----------|------|
| `package.json` | scripts・dependencies を書き換えて流用 |
| `tsconfig.json` | そのまま流用 |
| `vitest.config.ts` | そのまま流用 |
| `.gitignore` | 更新して流用 |
| `CLAUDE.md` | WB ツール向けに書き換え |
| `refrence.md` | WB API のリファレンスとして継続利用 |
| `out/` | 出力ディレクトリとして継続利用（中身はクリア） |

---

## アーキテクチャ

```
ユーザー
  │ 「イラン戦争の経済的影響を調べたい」
  ▼
wb-cli.ts (対話ループ)
  │
  ▼
wb-agent.ts (Claude API + tool use ループ)
  │
  │  ── フェーズ1: 分析設計 ──
  ├─→ search_indicators   … WDI指標をキーワード検索
  ├─→ list_countries       … 国/地域コードを検索
  │
  │  ── フェーズ2: データ取得 ──
  ├─→ fetch_wb_data        … World Bank API からデータ取得
  │
  │  ── フェーズ3: 出力 ──
  ├─→ export_csv           … CSV を out/ に出力
  └─→ build_chart_site     … Chart.js HTMLを site/ に出力
  │
  ▼
out/   … CSV + メタデータJSON
site/  … index.html (チャート付きダッシュボード)
```

---

## ファイル構成 (最終状態)

旧カタログ関連を全削除し、WBツールのみのクリーンな構成にする。

```
gather_worldbank_data/
├── src/
│   ├── wb-cli.ts              # エントリポイント (対話ループ)
│   ├── wb-agent.ts            # エージェントコア (システムプロンプト + tool useループ)
│   ├── wb-api.ts              # World Bank API クライアント (型定義含む)
│   ├── wb-store.ts            # セッション内データストア
│   └── tools/
│       ├── search-indicators.ts   # 指標検索
│       ├── list-countries.ts      # 国コード検索
│       ├── fetch-wb-data.ts       # データ取得
│       ├── export-csv.ts          # CSV出力
│       └── build-chart-site.ts    # 可視化HTML生成
├── tests/
│   └── wb-*.test.ts           # WB用テスト
├── out/                       # CSV + メタデータ出力先
├── site/                      # 可視化HTML出力先 (build-chart-site が生成)
├── package.json               # 書き換え (不要な依存を削除、scripts変更)
├── tsconfig.json              # 流用
├── vitest.config.ts           # 流用
├── refrence.md                # WB APIリファレンス
├── CLAUDE.md                  # WBツール向けに書き換え
└── .gitignore                 # 更新
```

### package.json の変更

```jsonc
{
  "scripts": {
    "start": "tsx src/wb-cli.ts",    // メインエントリを差し替え
    "wb": "tsx src/wb-cli.ts",       // エイリアス
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
    // build:catalog, build:site, preview は削除
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.78.0"
    // better-sqlite3, yaml, zod は削除 (WBツールでは不使用)
  },
  "devDependencies": {
    // @types/better-sqlite3 は削除
  }
}
```

---

## 各モジュールの詳細

### 1. `src/wb-api.ts` — World Bank API クライアント

refrence.md のサンプルコードをベースに、型安全な API クライアントを実装。

```ts
const WB_BASE = "https://api.worldbank.org/v2";
const SOURCE_ID = 2; // WDI

// --- 型定義 ---

interface WbIndicator {
  id: string;           // "NY.GDP.MKTP.KD.ZG"
  name: string;         // "GDP growth (annual %)"
  sourceNote: string;   // 詳細説明
}

interface WbCountry {
  id: string;           // "JPN"
  name: string;         // "Japan"
  region: string;       // "East Asia & Pacific"
  incomeLevel: string;  // "High income"
}

interface WbRow {
  country: string;      // "Japan"
  iso3: string;         // "JPN"
  indicator: string;    // "NY.GDP.MKTP.KD.ZG"
  indicatorName: string;// "GDP growth (annual %)"
  year: number;
  value: number | null;
}

interface FetchParams {
  countries: string[];
  indicators: string[];
  startYear: number;
  endYear: number;
}

// --- 関数 ---

/** 指標をキーワード検索。WB API の /indicator エンドポイントを使用 */
async function searchIndicators(query: string, perPage = 50): Promise<WbIndicator[]>
  // GET /v2/indicator?format=json&per_page=50&source=2&search={query}

/** 国/地域一覧を取得 */
async function listCountries(): Promise<WbCountry[]>
  // GET /v2/country?format=json&per_page=300

/** データ取得。1指標ずつ取得してマージ（API安定性のため） */
async function fetchData(params: FetchParams): Promise<WbRow[]>
  // 指標ごとにループ:
  //   GET /v2/country/{countries}/indicator/{indicator}?source=2&format=json&date={start}:{end}&per_page=1000
  //   ページネーション対応

/** APIレスポンスを正規化 */
function normalizeRow(raw: Record<string, unknown>): WbRow
```

**設計判断**:
- refrence.md の Tips に従い、**1指標ずつ取得**してマージ（複数指標一括は不安定）
- `per_page=1000` でページネーション必須
- null値はフィルタせず保持（欠損を可視化でも表現するため）

### 2. `src/wb-store.ts` — セッション内データストア

```ts
/** 取得データをメモリ上に蓄積する。セッション終了で破棄 */

interface DataBatch {
  id: string;            // "batch_001"
  label: string;         // "イラン GDP成長率 2015-2025"
  params: FetchParams;   // 取得パラメータ（再現性のため保持）
  rows: WbRow[];
  fetchedAt: string;     // ISO8601
}

// モジュールスコープで保持
const batches: DataBatch[] = [];

function addBatch(batch: DataBatch): void
function getAllBatches(): DataBatch[]
function getAllRows(): WbRow[]       // 全バッチのrowsを結合
function clearStore(): void
function getSummary(): string        // 件数、国数、指標数、期間の要約
```

複数回の `fetch_wb_data` の結果が蓄積され、`export_csv` / `build_chart_site` で一括出力される。

### 3. `src/tools/search-indicators.ts`

```
ツール名: search_indicators
入力: { query: "GDP growth" }
出力: 指標コード・名前・説明の一覧 (最大20件)
```

エージェントがこの結果を見て適切な指標コードを選択する。

### 4. `src/tools/list-countries.ts`

```
ツール名: list_countries
入力: { query?: "Middle East" }  // オプショナル
出力: ISO3コード・国名・地域・所得水準の一覧
```

query あり → 地域名・国名でフィルタ。query なし → 全件返却。
エージェントが「イラン」→ `IRN`、「中東諸国」→ 複数コード展開などに使う。

### 5. `src/tools/fetch-wb-data.ts`

```
ツール名: fetch_wb_data
入力: {
  countries: ["IRN", "SAU", "IRQ"],
  indicators: ["NY.GDP.MKTP.KD.ZG"],
  start_year: 2015,
  end_year: 2025,
  label: "中東主要国 GDP成長率"
}
出力: "取得完了: 33件 (3カ国 × 11年). バッチID: batch_001\n先頭5行:\n..."
```

- wb-api.ts の fetchData() を呼び、結果を wb-store に蓄積
- エージェントには件数と先頭数行を返す（全データは返さない、トークン節約）

### 6. `src/tools/export-csv.ts`

```
ツール名: export_csv
入力: { filename: "iran_war_economic_impact" }
出力: "出力完了: out/iran_war_economic_impact_20260328.csv (156行)"
```

- wb-store の全バッチを結合して1つのCSVに出力
- 列: `country,iso3,indicator,indicator_name,year,value`
- 同時に `out/{filename}_20260328_meta.json` にメタデータ（取得パラメータ、バッチ一覧）も出力

### 7. `src/tools/build-chart-site.ts` — 可視化HTML生成

```
ツール名: build_chart_site
入力: {
  title: "イラン戦争の経済的影響",
  description: "中東主要国の経済指標推移（2015-2025）"
}
出力: "サイト生成完了: site/index.html (チャート5個)\nプレビュー: npx serve site"
```

**生成する `site/` の内容**:

```
site/
├── index.html      … ダッシュボードHTML（Chart.js CDN読み込み）
├── data.json       … 取得データ（チャート描画用）
└── style.css       … スタイル
```

**HTMLの構成**:

```html
<!-- 自動生成されるダッシュボード -->
<h1>イラン戦争の経済的影響</h1>
<p>中東主要国の経済指標推移（2015-2025）</p>

<!-- 指標ごとにチャートを自動生成 -->
<section class="chart-section">
  <h2>GDP growth (annual %)</h2>
  <canvas id="chart-NY_GDP_MKTP_KD_ZG"></canvas>
</section>

<section class="chart-section">
  <h2>Inflation, consumer prices (annual %)</h2>
  <canvas id="chart-FP_CPI_TOTL_ZG"></canvas>
</section>
<!-- ... 指標の数だけ繰り返し -->
```

**チャートの仕様**:
- **Chart.js** を CDN から読み込み（依存パッケージ追加不要）
- 指標ごとに1つの折れ線チャート（X軸: 年、Y軸: 値、国ごとに線を分ける）
- 国ごとに色分け、凡例付き
- レスポンシブ対応
- `data.json` を fetch して描画（HTMLにデータを直書きしない）

**生成ロジック** (`build-chart-site.ts` 内):
```ts
function generateDashboard(title: string, description: string): void {
  const rows = getAllRows();  // wb-store から全データ取得

  // data.json: チャート描画用にグループ化
  const data = {
    title,
    description,
    generatedAt: new Date().toISOString(),
    // 指標ごと → 国ごと → [{year, value}] にネスト
    indicators: groupByIndicator(rows),
    countries: [...new Set(rows.map(r => r.iso3))],
  };

  // index.html: Chart.js でチャートを描画するスクリプトを含む
  // 指標の数は動的なので、data.json の構造に基づいてチャートを生成
  const html = renderDashboardHTML(title, description);
  const css = renderDashboardCSS();

  fs.writeFileSync("site/data.json", JSON.stringify(data, null, 2));
  fs.writeFileSync("site/index.html", html);
  fs.writeFileSync("site/style.css", css);
}
```

### 8. `src/wb-agent.ts` — エージェントコア

既存 `agent.ts` と同じ構造。**分析設計能力**を持つシステムプロンプトが核心。

```markdown
## システムプロンプト

あなたは World Bank データ分析エージェントです。
ユーザーの自然言語の指示から、適切なデータを設計・取得・可視化します。

## 行動指針

### フェーズ1: 分析設計
ユーザーの要求を分析し、以下を自律的に決定する：
- **対象国**: テーマから関連国を推論する
  例: 「イラン戦争の経済影響」→ イラン本国 + 周辺国(イラク,サウジ等) + 原油輸入大国(日本,中国,インド等)
- **対象指標**: テーマに適した経済指標を選定する
  例: 「経済的影響」→ GDP成長率, インフレ率, 経常収支, 貿易依存度, 原油収入比率, 対外債務 等
- **対象期間**: 分析に必要な時間幅を判断する
  例: 戦争の影響 → 開戦前5年〜現在（比較のため平時も含める）

判断に迷った場合は search_indicators / list_countries で候補を確認する。

### フェーズ2: データ取得
- 設計した計画に基づき fetch_wb_data を複数回呼ぶ
- 1指標ずつ取得する（API安定性のため）
- 取得結果を確認し、データが十分か判断する

### フェーズ3: 出力
- export_csv で CSV を out/ に出力する
- build_chart_site で可視化HTMLを site/ に出力する
- ユーザーに取得内容のサマリーを報告する

## 主要WDI指標リファレンス（search_indicators を省略可能にする）

| コード | 名前 | カテゴリ |
|--------|------|----------|
| NY.GDP.MKTP.KD.ZG | GDP growth (annual %) | 成長 |
| NY.GDP.MKTP.CD | GDP (current US$) | 成長 |
| NY.GDP.PCAP.CD | GDP per capita (current US$) | 成長 |
| FP.CPI.TOTL.ZG | Inflation, consumer prices (annual %) | 物価 |
| NE.TRD.GNFS.ZS | Trade (% of GDP) | 貿易 |
| NE.IMP.GNFS.ZS | Imports of goods and services (% of GDP) | 貿易 |
| NE.EXP.GNFS.ZS | Exports of goods and services (% of GDP) | 貿易 |
| BN.CAB.XOKA.GD.ZS | Current account balance (% of GDP) | 国際収支 |
| NY.GDP.PETR.RT.ZS | Oil rents (% of GDP) | 資源 |
| EG.IMP.CONS.ZS | Energy imports, net (% of energy use) | エネルギー |
| DT.DOD.DECT.CD | External debt stocks, total (DOD, current US$) | 債務 |
| GC.XPN.INTP.RV.ZS | Interest payments (% of revenue) | 財政 |
| NE.GDI.TOTL.ZS | Gross capital formation (% of GDP) | 投資 |
| BX.KLT.DINV.WD.GD.ZS | Foreign direct investment, net inflows (% of GDP) | 投資 |
| SL.UEM.TOTL.ZS | Unemployment, total (% of total labor force) | 労働 |
| PV.EST | Political Stability and Absence of Violence | ガバナンス |
| PA.NUS.FCRF | Official exchange rate (LCU per US$) | 為替 |
| FI.RES.TOTL.CD | Total reserves (includes gold, current US$) | 外貨準備 |
```

### 9. `src/wb-cli.ts` — CLIエントリポイント

```ts
// 起動: npm run wb
// 対話ループ: 既存 index.ts と同パターン
// セッション開始時に wb-store をクリア
// "exit" で終了
```

---

## データフロー例: 「イラン戦争の経済的影響」

```
ユーザー:
  「現在起きているイラン戦争の経済的な影響を図りたい。
   適切と思われるデータをダウンロードしてoutディレクトリに出力して、
   ダウンロードしたデータを確認できるようにsite/ディレクトリに可視化したサイトを出力して」

エージェント思考:

  [フェーズ1: 分析設計]
  テーマ: イラン戦争 → 経済的影響
  対象国:
    - 当事国: IRN (イラン)
    - 周辺国: IRQ (イラク), SAU (サウジアラビア), ARE (UAE), ISR (イスラエル)
    - 原油輸入大国: JPN (日本), CHN (中国), IND (インド)
  対象指標:
    - NY.GDP.MKTP.KD.ZG  … GDP成長率
    - FP.CPI.TOTL.ZG     … インフレ率
    - NY.GDP.PETR.RT.ZS  … 石油レント
    - BN.CAB.XOKA.GD.ZS  … 経常収支
    - NE.TRD.GNFS.ZS     … 貿易依存度
    - PA.NUS.FCRF         … 為替レート
  期間: 2018〜2025（戦争前の平時データも含める）

  → list_countries({ query: "Middle East" }) で周辺国コードを確認
  → search_indicators("oil rents") で指標コードを確認（念のため）

  [フェーズ2: データ取得]
  → fetch_wb_data({ countries: ["IRN","IRQ","SAU","ARE","ISR","JPN","CHN","IND"],
                     indicators: ["NY.GDP.MKTP.KD.ZG"], start_year: 2018, end_year: 2025,
                     label: "GDP成長率" })
  → fetch_wb_data({ ... indicators: ["FP.CPI.TOTL.ZG"], label: "インフレ率" })
  → fetch_wb_data({ ... indicators: ["NY.GDP.PETR.RT.ZS"], label: "石油レント" })
  → fetch_wb_data({ ... indicators: ["BN.CAB.XOKA.GD.ZS"], label: "経常収支" })
  → fetch_wb_data({ ... indicators: ["NE.TRD.GNFS.ZS"], label: "貿易依存度" })
  → fetch_wb_data({ ... indicators: ["PA.NUS.FCRF"], label: "為替レート" })

  [フェーズ3: 出力]
  → export_csv({ filename: "iran_war_economic_impact" })
    → out/iran_war_economic_impact_20260328.csv
    → out/iran_war_economic_impact_20260328_meta.json

  → build_chart_site({ title: "イラン戦争の経済的影響",
                        description: "中東主要国と原油輸入大国の経済指標推移（2018-2025）" })
    → site/index.html  (6つの折れ線チャート)
    → site/data.json
    → site/style.css

ユーザーへの報告:
  「6指標 × 8カ国のデータを取得しました。
   - CSV: out/iran_war_economic_impact_20260328.csv (384行)
   - 可視化: site/index.html をブラウザで開いてください
   イランのGDP成長率は2024年に急落し、インフレ率は...（要約）」
```

---

## 可視化ダッシュボードの詳細設計

### 生成される `site/index.html` のイメージ

```
┌─────────────────────────────────────────────────┐
│  イラン戦争の経済的影響                              │
│  中東主要国と原油輸入大国の経済指標推移（2018-2025）    │
│  Generated: 2026-03-28  |  6 indicators, 8 countries │
├─────────────────────────────────────────────────┤
│                                                     │
│  GDP growth (annual %)                              │
│  ┌───────────────────────────────────┐              │
│  │  📈 折れ線チャート                    │              │
│  │  X軸: 2018...2025                   │              │
│  │  Y軸: %                             │              │
│  │  線: IRN, IRQ, SAU, ... 国ごとに色分け │              │
│  └───────────────────────────────────┘              │
│                                                     │
│  Inflation, consumer prices (annual %)              │
│  ┌───────────────────────────────────┐              │
│  │  📈 折れ線チャート                    │              │
│  └───────────────────────────────────┘              │
│                                                     │
│  ... (指標の数だけ繰り返し)                            │
│                                                     │
├─────────────────────────────────────────────────┤
│  Data source: World Bank WDI                        │
│  Total rows: 384                                    │
└─────────────────────────────────────────────────┘
```

### 技術選定

| 要素 | 選定 | 理由 |
|------|------|------|
| チャートライブラリ | **Chart.js** (CDN) | 依存追加不要、折れ線チャートに十分、軽量 |
| データ受け渡し | `data.json` を fetch | HTMLとデータを分離、再利用可能 |
| CSS | 生成時に埋め込み | 外部依存なしで完結 |

### `data.json` の構造

```json
{
  "title": "イラン戦争の経済的影響",
  "description": "中東主要国と原油輸入大国の経済指標推移（2018-2025）",
  "generatedAt": "2026-03-28T12:00:00Z",
  "countries": ["IRN", "IRQ", "SAU", "ARE", "ISR", "JPN", "CHN", "IND"],
  "countryNames": { "IRN": "Iran", "IRQ": "Iraq", ... },
  "indicators": [
    {
      "id": "NY.GDP.MKTP.KD.ZG",
      "name": "GDP growth (annual %)",
      "years": [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
      "series": {
        "IRN": [null, -6.8, 3.3, 4.7, 3.8, 5.4, -2.1, null],
        "SAU": [2.4, 0.3, -4.1, 3.9, 8.7, -0.8, null, null]
      }
    }
  ]
}
```

---

## package.json 変更

```json
{
  "scripts": {
    "wb": "tsx src/wb-cli.ts"
  }
}
```

---

## 実装順序

| Step | 内容 | 依存 |
|------|------|------|
| 0 | **既存コード削除** — 旧カタログ関連ファイルを全削除、package.json整理、CLAUDE.md書き換え | なし |
| 1 | `src/wb-api.ts` — API クライアント + 型定義 | なし |
| 2 | `src/wb-store.ts` — セッション内データストア | wb-api.ts (型のみ) |
| 3 | `src/tools/search-indicators.ts` | wb-api.ts |
| 4 | `src/tools/list-countries.ts` | wb-api.ts |
| 5 | `src/tools/fetch-wb-data.ts` | wb-api.ts, wb-store.ts |
| 6 | `src/tools/export-csv.ts` | wb-store.ts |
| 7 | `src/tools/build-chart-site.ts` | wb-store.ts |
| 8 | `src/wb-agent.ts` — エージェントコア | 全ツール |
| 9 | `src/wb-cli.ts` — CLIエントリポイント | wb-agent.ts |
| 10 | テスト (`tests/wb-*.test.ts`) | 各モジュール |

---

## 検討事項・決定済み

| # | 論点 | 決定 | 理由 |
|---|------|------|------|
| Q1 | データ一時保持 | メモリ (wb-store.ts) | 1セッション完結、シンプル |
| Q2 | 指標の事前知識 | プロンプト埋め込み (18指標) | API呼び出し削減、判断精度向上 |
| Q3 | 出力形式 | CSV + メタデータJSON | 汎用的、Excel/pandas互換 |
| Q4 | 既存カタログ統合 | 分離 | 後で統合余地は残す |
| Q5 | 可視化 | Chart.js CDN + site/出力 | 依存追加不要、十分な表現力 |
| Q6 | 分析設計 | エージェントのプロンプトで対応 | 専用ツール不要、LLMの推論力で十分 |

---

## 制約・前提

- World Bank API は認証不要、レート制限は緩い
- WDI (source=2) を主なデータソースとする
- 年次データが中心（WDIの特性上）
- null（欠損値）が多い — チャートでは線の途切れとして表現
- 出力先: CSV → `out/`, 可視化 → `site/`
- 既存の `site/` 内容（旧カタログビューア）は Step 0 で削除済み。`build_chart_site` が毎回クリーン生成する
