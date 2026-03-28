# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Claude API の tool use を活用した **World Bank データ取得 AIエージェント CLI**。自然言語で指示すると、AIが分析に必要な指標・国・期間を自律的に判断し、World Bank API からデータを取得・CSV出力・チャート可視化する。

## コマンド

```bash
npm install            # 依存パッケージインストール
npm start              # 対話型CLI起動
npm run wb             # 同上（エイリアス）
npm test               # Vitestテスト実行
npm run typecheck      # TypeScript型チェック（strict mode）
```

## アーキテクチャ

- **CLI層**: `src/wb-cli.ts` — readline対話ループ
- **エージェント層**: `src/wb-agent.ts` — Claude API (claude-sonnet-4-20250514) + tool useループ
- **APIクライアント**: `src/wb-api.ts` — World Bank API v2 クライアント + 型定義
- **データストア**: `src/wb-store.ts` — セッション内メモリストア（取得データの蓄積）
- **ツール群**: `src/tools/` — search-indicators, list-countries, fetch-wb-data, export-csv, build-chart-site

### ツール一覧

| ツール名 | ファイル | 役割 |
|----------|----------|------|
| `search_indicators` | `search-indicators.ts` | WDI指標をキーワード検索 |
| `list_countries` | `list-countries.ts` | 国/地域コードを検索 |
| `fetch_wb_data` | `fetch-wb-data.ts` | World Bank API からデータ取得、wb-storeに蓄積 |
| `export_csv` | `export-csv.ts` | wb-storeの全データをCSVで `out/` に出力 |
| `build_chart_site` | `build-chart-site.ts` | Chart.js ダッシュボードHTMLを `site/` に生成 |

### 出力先

| ディレクトリ | 内容 | Git管理 |
|---|---|---|
| `out/` | CSV + メタデータJSON | No (.gitignore) |
| `site/` | 可視化ダッシュボードHTML（build_chart_siteが生成） | No (.gitignore) |

## コーディング規約

- ESM TypeScript (strict)、インポートは `.js` 拡張子
- 2スペースインデント
- 関数: camelCase、型: PascalCase、ツールファイル: kebab-case
- 型定義は `src/wb-api.ts` に集約

## テスト

- Vitest使用、`globals: true` 設定済み
- API呼び出しを含むテストではモックを使用
- 成功パスと空結果パスの両方をカバーすること

## 環境変数

- `ANTHROPIC_API_KEY` — CLI実行に必須（World Bank API は認証不要）

## 日本語対応

- 開発者向け応答・コミットメッセージは日本語で記述

