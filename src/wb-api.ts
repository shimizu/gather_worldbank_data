/**
 * World Bank API v2 クライアント。
 *
 * WDI (World Development Indicators, source=2) を主なデータソースとする。
 * 認証不要。1指標ずつ取得してマージする設計（API安定性のため）。
 *
 * 参考: refrence.md
 */

const WB_BASE = "https://api.worldbank.org/v2";
const SOURCE_ID = 2;
const PER_PAGE = 1000;
const TIMEOUT_MS = 15_000;

// =============================================================================
// 型定義
// =============================================================================

export interface WbIndicator {
  id: string;           // "NY.GDP.MKTP.KD.ZG"
  name: string;         // "GDP growth (annual %)"
  sourceNote: string;   // 詳細説明
}

export interface WbCountry {
  id: string;           // "JPN"
  name: string;         // "Japan"
  region: string;       // "East Asia & Pacific"
  incomeLevel: string;  // "High income"
}

export interface WbRow {
  country: string;      // "Japan"
  iso3: string;         // "JPN"
  indicator: string;    // "NY.GDP.MKTP.KD.ZG"
  indicatorName: string;// "GDP growth (annual %)"
  year: number;
  value: number | null;
}

export interface FetchParams {
  countries: string[];
  indicators: string[];
  startYear: number;
  endYear: number;
}

// =============================================================================
// API呼び出し共通
// =============================================================================

async function wbFetch(path: string, params: Record<string, string | number> = {}): Promise<unknown[]> {
  const query = new URLSearchParams({
    format: "json",
    per_page: String(PER_PAGE),
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });

  const url = `${WB_BASE}${path}?${query}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });

  if (!res.ok) {
    throw new Error(`World Bank API エラー: HTTP ${res.status} (${url})`);
  }

  const json = await res.json() as unknown[];

  // WB API は [メタデータ, データ配列] の形式で返す
  // データがない場合は json[1] が undefined
  if (!Array.isArray(json) || json.length < 2) {
    return [];
  }

  return (json[1] as unknown[]) ?? [];
}

/** ページネーション付きで全ページ取得 */
async function wbFetchAll(path: string, params: Record<string, string | number> = {}): Promise<unknown[]> {
  const query = new URLSearchParams({
    format: "json",
    per_page: String(PER_PAGE),
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });

  const firstUrl = `${WB_BASE}${path}?${query}`;
  const firstRes = await fetch(firstUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });

  if (!firstRes.ok) {
    throw new Error(`World Bank API エラー: HTTP ${firstRes.status}`);
  }

  const firstJson = await firstRes.json() as unknown[];
  if (!Array.isArray(firstJson) || firstJson.length < 2) return [];

  const meta = firstJson[0] as { pages?: number };
  const allRows: unknown[] = (firstJson[1] as unknown[]) ?? [];
  const totalPages = meta.pages ?? 1;

  for (let page = 2; page <= totalPages; page++) {
    const pageQuery = new URLSearchParams({
      format: "json",
      per_page: String(PER_PAGE),
      page: String(page),
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    });

    const url = `${WB_BASE}${path}?${pageQuery}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) continue;

    const json = await res.json() as unknown[];
    if (Array.isArray(json) && json.length >= 2 && Array.isArray(json[1])) {
      allRows.push(...json[1]);
    }
  }

  return allRows;
}

// =============================================================================
// 公開API
// =============================================================================

/**
 * WDI指標をキーワード検索する。
 * GET /v2/indicator?source=2&search={query}
 */
export async function searchIndicators(query: string, perPage = 50): Promise<WbIndicator[]> {
  const rows = await wbFetch("/indicator", {
    source: SOURCE_ID,
    search: query,
    per_page: perPage,
  });

  return rows.map((r: unknown) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      name: row.name as string,
      sourceNote: (row.sourceNote as string) ?? "",
    };
  });
}

/**
 * 国/地域一覧を取得する。
 * GET /v2/country?per_page=300
 * "Aggregates" を除外し、実際の国のみ返す。
 */
export async function listCountries(): Promise<WbCountry[]> {
  const rows = await wbFetchAll("/country", { per_page: 300 });

  return rows
    .map((r: unknown) => {
      const row = r as Record<string, unknown>;
      const region = row.region as Record<string, unknown> | undefined;
      const income = row.incomeLevel as Record<string, unknown> | undefined;
      return {
        id: row.id as string,
        name: row.name as string,
        region: (region?.value as string) ?? "",
        incomeLevel: (income?.value as string) ?? "",
      };
    })
    .filter((c) => c.region !== "Aggregates");
}

/**
 * World Bank API からデータを取得する。
 * 1指標ずつ取得してマージ（API安定性のため）。
 */
export async function fetchData(params: FetchParams): Promise<WbRow[]> {
  const { countries, indicators, startYear, endYear } = params;
  const countryPart = countries.join(";");
  const allRows: WbRow[] = [];

  for (const indicator of indicators) {
    const rows = await wbFetchAll(
      `/country/${countryPart}/indicator/${indicator}`,
      {
        source: SOURCE_ID,
        date: `${startYear}:${endYear}`,
      }
    );

    for (const r of rows) {
      const row = r as Record<string, unknown>;
      allRows.push({
        country: (row.country as Record<string, unknown>)?.value as string,
        iso3: row.countryiso3code as string,
        indicator: (row.indicator as Record<string, unknown>)?.id as string,
        indicatorName: (row.indicator as Record<string, unknown>)?.value as string,
        year: Number(row.date),
        value: row.value as number | null,
      });
    }
  }

  return allRows;
}
