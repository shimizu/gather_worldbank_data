# gather-worldbank-data

Claude API の tool use を活用した **World Bank データ取得 AIエージェント CLI**。

自然言語で指示すると、AIが分析に必要な指標・国・期間を自律的に判断し、World Bank API からデータを取得・CSV出力・チャート可視化する。

## セットアップ

```bash
npm install
```

## 環境変数

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

World Bank API は認証不要。

## 使い方

```bash
npm start
# または
npm run wb
```

対話型CLIが起動する。自然言語でWorld Bankのデータについて指示できる。

```
=== World Bank データ取得 AIエージェント ===

> 日本とアメリカのGDP推移を2000年から比較して
> ASEAN諸国の人口データを取得してCSVに出力して
> G7の一人当たりGDPをチャートで可視化して
```

### 動作の流れ

1. 自然言語の指示からAIが必要な指標・国・期間を判断
2. World Bank API (WDI) から該当データを取得しメモリストアに蓄積
3. 必要に応じてCSV出力やチャート可視化を実行

### 終了

```
> exit
```

## ツール一覧

AIエージェントが利用可能なツール:

| ツール名 | 役割 |
|----------|------|
| `search_indicators` | WDI指標をキーワード検索 |
| `list_countries` | 国/地域コードを検索 |
| `fetch_wb_data` | World Bank API からデータ取得、ストアに蓄積 |
| `export_csv` | ストアの全データをCSVで `out/` に出力 |
| `build_chart_site` | Chart.js ダッシュボードHTMLを `site/` に生成 |

## 出力先

| ディレクトリ | 内容 | Git管理 |
|---|---|---|
| `out/` | CSV + メタデータJSON | No (.gitignore) |
| `site/` | 可視化ダッシュボードHTML | No (.gitignore) |

## ディレクトリ構成

```
gather_worldbank_data/
├── src/
│   ├── wb-cli.ts          # 対話型CLIエントリポイント
│   ├── wb-agent.ts        # エージェントコア (Claude API + tool use)
│   ├── wb-api.ts          # World Bank API v2 クライアント + 型定義
│   ├── wb-store.ts        # セッション内メモリストア
│   └── tools/
│       ├── search-indicators.ts  # WDI指標検索
│       ├── list-countries.ts     # 国/地域コード検索
│       ├── fetch-wb-data.ts      # データ取得
│       ├── export-csv.ts         # CSV出力
│       └── build-chart-site.ts   # チャート可視化HTML生成
├── out/                   # CSV出力先 (.gitignore)
├── site/                  # 可視化HTML出力先 (.gitignore)
└── tests/
```

## テスト

```bash
npm test               # Vitestテスト実行
npm run typecheck      # TypeScript型チェック
```
