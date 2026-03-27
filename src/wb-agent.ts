/**
 * World Bank データ取得エージェント。
 *
 * Claude API の tool use を使ったエージェントループ。
 * ユーザーの自然言語指示から、分析設計→データ取得→出力を自律的に行う。
 */
import Anthropic from "@anthropic-ai/sdk";
import { searchIndicatorsTool } from "./tools/search-indicators.js";
import { listCountriesTool } from "./tools/list-countries.js";
import { fetchWbDataTool } from "./tools/fetch-wb-data.js";
import { exportCsvTool } from "./tools/export-csv.js";
import { buildChartSiteTool } from "./tools/build-chart-site.js";
import { getSummary } from "./wb-store.js";

const SYSTEM_PROMPT = `あなたは World Bank データ分析エージェントです。
ユーザーの自然言語の指示から、適切なデータを設計・取得・可視化します。

## 行動指針

### フェーズ1: 分析設計
ユーザーの要求を分析し、以下を自律的に決定する：
- **対象国**: テーマから関連国を推論する
  例: 「イラン戦争の経済影響」→ イラン本国 + 周辺国(イラク,サウジ等) + 原油輸入大国(日本,中国,インド等)
- **対象指標**: テーマに適した経済指標を選定する（下記リファレンス参照）
  例: 「経済的影響」→ GDP成長率, インフレ率, 経常収支, 貿易依存度, 原油収入比率, 対外債務 等
- **対象期間**: 分析に必要な時間幅を判断する
  例: 戦争の影響 → 開戦前5年〜現在（比較のため平時も含める）

判断に迷った場合は search_indicators / list_countries で候補を確認する。
分析設計が決まったら、取得計画をユーザーに簡潔に説明してからデータ取得に進む。

### フェーズ2: データ取得
- 設計した計画に基づき fetch_wb_data を複数回呼ぶ
- 1回の呼び出しで指標は1〜2個まで（API安定性のため）
- 取得結果を確認し、データが十分か判断する

### フェーズ3: 出力
- export_csv で CSV を out/ に出力する
- build_chart_site で可視化HTMLを site/ に出力する
- ユーザーに取得内容のサマリーを報告する

## 主要WDI指標リファレンス

以下はよく使う指標のリスト。ここにあるものは search_indicators を呼ばずに直接使ってよい。

### 成長・GDP
- NY.GDP.MKTP.KD.ZG — GDP growth (annual %)
- NY.GDP.MKTP.CD — GDP (current US$)
- NY.GDP.PCAP.CD — GDP per capita (current US$)
- NY.GDP.PCAP.PP.CD — GDP per capita, PPP (current international $)

### 物価・金融
- FP.CPI.TOTL.ZG — Inflation, consumer prices (annual %)
- PA.NUS.FCRF — Official exchange rate (LCU per US$)
- FI.RES.TOTL.CD — Total reserves (includes gold, current US$)
- FR.INR.RINR — Real interest rate (%)

### 貿易・国際収支
- NE.TRD.GNFS.ZS — Trade (% of GDP)
- NE.IMP.GNFS.ZS — Imports of goods and services (% of GDP)
- NE.EXP.GNFS.ZS — Exports of goods and services (% of GDP)
- BN.CAB.XOKA.GD.ZS — Current account balance (% of GDP)
- BX.KLT.DINV.WD.GD.ZS — Foreign direct investment, net inflows (% of GDP)

### 資源・エネルギー
- NY.GDP.PETR.RT.ZS — Oil rents (% of GDP)
- EG.IMP.CONS.ZS — Energy imports, net (% of energy use)
- NY.GDP.TOTL.RT.ZS — Total natural resources rents (% of GDP)

### 財政・債務
- DT.DOD.DECT.CD — External debt stocks, total (DOD, current US$)
- GC.XPN.INTP.RV.ZS — Interest payments (% of revenue)
- GC.DOD.TOTL.GD.ZS — Central government debt, total (% of GDP)

### 投資・資本形成
- NE.GDI.TOTL.ZS — Gross capital formation (% of GDP)

### 労働・社会
- SL.UEM.TOTL.ZS — Unemployment, total (% of total labor force)
- SP.POP.TOTL — Population, total

### ガバナンス
- PV.EST — Political Stability and Absence of Violence/Terrorism

## 注意点
- World Bank API は年次データが中心。月次・四半期データはない。
- 最新年のデータはnull（未公表）の場合が多い。
- last_confirmed: ${new Date().toISOString().split("T")[0]}`;

const tools: Anthropic.Tool[] = [
  {
    name: "search_indicators",
    description:
      "WDI指標をキーワード検索します。リファレンスにない指標を探す場合に使ってください。",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "検索キーワード（英語推奨。例: 'GDP growth', 'oil rents'）",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_countries",
    description:
      "国/地域のISO3コード一覧を取得します。地域名や国名でフィルタ可能。",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "フィルタキーワード（例: 'Middle East', 'Iran', 'High income'）。省略で全件。",
        },
      },
      required: [],
    },
  },
  {
    name: "fetch_wb_data",
    description:
      "World Bank API からデータを取得し、セッションに蓄積します。1回に指標は1〜2個まで。",
    input_schema: {
      type: "object" as const,
      properties: {
        countries: {
          type: "array",
          items: { type: "string" },
          description: "ISO3国コードの配列（例: ['JPN', 'USA', 'CHN']）",
        },
        indicators: {
          type: "array",
          items: { type: "string" },
          description: "WDI指標コードの配列（例: ['NY.GDP.MKTP.KD.ZG']）",
        },
        start_year: {
          type: "number",
          description: "開始年（例: 2015）",
        },
        end_year: {
          type: "number",
          description: "終了年（例: 2025）",
        },
        label: {
          type: "string",
          description: "このデータバッチの説明ラベル（例: '中東主要国 GDP成長率'）",
        },
      },
      required: ["countries", "indicators", "start_year", "end_year", "label"],
    },
  },
  {
    name: "export_csv",
    description:
      "蓄積した全データをCSVファイルとして out/ に出力します。メタデータJSONも同時出力。",
    input_schema: {
      type: "object" as const,
      properties: {
        filename: {
          type: "string",
          description: "出力ファイル名（拡張子不要、日付は自動付与。例: 'iran_war_economic_impact'）",
        },
      },
      required: ["filename"],
    },
  },
  {
    name: "build_chart_site",
    description:
      "蓄積した全データを Chart.js ダッシュボードHTML として site/ に出力します。指標ごとに折れ線チャートを生成。",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "ダッシュボードのタイトル",
        },
        description: {
          type: "string",
          description: "ダッシュボードの説明文",
        },
      },
      required: ["title", "description"],
    },
  },
];

async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "search_indicators":
      return await searchIndicatorsTool(input.query as string);
    case "list_countries":
      return await listCountriesTool(input.query as string | undefined);
    case "fetch_wb_data":
      return await fetchWbDataTool(
        input.countries as string[],
        input.indicators as string[],
        input.start_year as number,
        input.end_year as number,
        input.label as string,
      );
    case "export_csv":
      return exportCsvTool(input.filename as string);
    case "build_chart_site":
      return buildChartSiteTool(input.title as string, input.description as string);
    default:
      return `未知のツール: ${name}`;
  }
}

export async function runAgent(userMessage: string): Promise<string> {
  const client = new Anthropic();

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    const textParts = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text);

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUseBlocks.length === 0) {
      return textParts.join("\n");
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      console.log(`  🔧 ${toolUse.name}(${JSON.stringify(toolUse.input).slice(0, 80)}...)`);
      const result = await executeTool(
        toolUse.name,
        toolUse.input as Record<string, unknown>,
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }
}
