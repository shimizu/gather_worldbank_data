/**
 * 可視化HTML生成ツール。
 * wb-store のデータを Chart.js ダッシュボードとして site/ に出力する。
 */
import fs from "node:fs";
import path from "node:path";
import { getAllRows } from "../wb-store.js";
import type { WbRow } from "../wb-api.js";

const SITE_DIR = path.resolve(import.meta.dirname, "../../site");

interface IndicatorData {
  id: string;
  name: string;
  years: number[];
  series: Record<string, (number | null)[]>;
}

function groupByIndicator(rows: WbRow[]): IndicatorData[] {
  const indicatorMap = new Map<string, { name: string; data: Map<string, Map<number, number | null>> }>();

  for (const row of rows) {
    if (!indicatorMap.has(row.indicator)) {
      indicatorMap.set(row.indicator, { name: row.indicatorName, data: new Map() });
    }
    const ind = indicatorMap.get(row.indicator)!;
    if (!ind.data.has(row.iso3)) {
      ind.data.set(row.iso3, new Map());
    }
    ind.data.get(row.iso3)!.set(row.year, row.value);
  }

  const result: IndicatorData[] = [];
  for (const [id, { name, data }] of indicatorMap) {
    const allYears = new Set<number>();
    for (const yearMap of data.values()) {
      for (const year of yearMap.keys()) allYears.add(year);
    }
    const years = [...allYears].sort((a, b) => a - b);

    const series: Record<string, (number | null)[]> = {};
    for (const [iso3, yearMap] of data) {
      series[iso3] = years.map((y) => yearMap.get(y) ?? null);
    }

    result.push({ id, name, years, series });
  }

  return result;
}

function renderHTML(title: string, description: string, indicatorCount: number): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="style.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <p class="description">${escapeHtml(description)}</p>
    <p class="meta" id="meta"></p>
  </header>
  <main id="charts"></main>
  <footer>
    <p>Data source: <a href="https://databank.worldbank.org/" target="_blank">World Bank WDI</a></p>
    <p id="footer-info"></p>
  </footer>
  <script src="app.js"></script>
</body>
</html>`;
}

function renderCSS(): string {
  return `* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #f5f7fa;
  color: #1a1a2e;
  line-height: 1.6;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}
header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e0e0e0;
}
h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
.description { color: #555; font-size: 1rem; }
.meta { color: #888; font-size: 0.85rem; margin-top: 0.5rem; }
.chart-section {
  background: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.chart-section h2 { font-size: 1.1rem; margin-bottom: 1rem; color: #333; }
canvas { max-height: 400px; }
footer {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
  color: #888;
  font-size: 0.85rem;
}
footer a { color: #4a90d9; }`;
}

function renderJS(): string {
  return `const COLORS = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
  '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990',
  '#dcbeff', '#9A6324', '#800000', '#aaffc3', '#808000',
  '#000075', '#a9a9a9'
];

async function init() {
  const res = await fetch('data.json');
  const data = await res.json();

  document.getElementById('meta').textContent =
    \`Generated: \${data.generatedAt.split('T')[0]} | \` +
    \`\${data.indicators.length} indicators | \` +
    \`\${data.countries.length} countries | \` +
    \`\${data.totalRows} rows\`;

  document.getElementById('footer-info').textContent =
    \`Countries: \${data.countries.join(', ')}\`;

  const chartsEl = document.getElementById('charts');

  for (const indicator of data.indicators) {
    const section = document.createElement('div');
    section.className = 'chart-section';

    const h2 = document.createElement('h2');
    h2.textContent = indicator.name + ' (' + indicator.id + ')';
    section.appendChild(h2);

    const canvas = document.createElement('canvas');
    section.appendChild(canvas);
    chartsEl.appendChild(section);

    const countryKeys = Object.keys(indicator.series);
    const datasets = countryKeys.map((iso3, i) => ({
      label: (data.countryNames[iso3] || iso3) + ' (' + iso3 + ')',
      data: indicator.series[iso3],
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '20',
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.1,
      spanGaps: true,
    }));

    new Chart(canvas, {
      type: 'line',
      data: { labels: indicator.years, datasets },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
        },
        scales: {
          x: { title: { display: true, text: 'Year' } },
          y: { title: { display: true, text: indicator.name } },
        },
      },
    });
  }
}

init();`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildChartSiteTool(title: string, description: string): string {
  const rows = getAllRows();

  if (rows.length === 0) {
    return "可視化するデータがありません。先に fetch_wb_data でデータを取得してください。";
  }

  if (!fs.existsSync(SITE_DIR)) {
    fs.mkdirSync(SITE_DIR, { recursive: true });
  }

  const indicators = groupByIndicator(rows);
  const countries = [...new Set(rows.map((r) => r.iso3))];
  const countryNames: Record<string, string> = {};
  for (const row of rows) {
    if (!countryNames[row.iso3]) countryNames[row.iso3] = row.country;
  }

  // data.json
  const data = {
    title,
    description,
    generatedAt: new Date().toISOString(),
    countries,
    countryNames,
    totalRows: rows.length,
    indicators: indicators.map((ind) => ({
      id: ind.id,
      name: ind.name,
      years: ind.years,
      series: ind.series,
    })),
  };

  fs.writeFileSync(path.join(SITE_DIR, "data.json"), JSON.stringify(data, null, 2), "utf-8");
  fs.writeFileSync(path.join(SITE_DIR, "index.html"), renderHTML(title, description, indicators.length), "utf-8");
  fs.writeFileSync(path.join(SITE_DIR, "style.css"), renderCSS(), "utf-8");
  fs.writeFileSync(path.join(SITE_DIR, "app.js"), renderJS(), "utf-8");

  return [
    `サイト生成完了: site/index.html`,
    `チャート数: ${indicators.length} (指標ごとに1チャート)`,
    `対象国: ${countries.join(", ")}`,
    `プレビュー: npx serve site`,
  ].join("\n");
}
