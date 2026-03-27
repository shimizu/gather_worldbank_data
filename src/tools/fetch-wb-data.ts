/**
 * データ取得ツール。
 * World Bank API からデータを取得し、wb-store に蓄積する。
 */
import { fetchData } from "../wb-api.js";
import { addBatch } from "../wb-store.js";
import type { FetchParams } from "../wb-api.js";

export async function fetchWbDataTool(
  countries: string[],
  indicators: string[],
  startYear: number,
  endYear: number,
  label: string,
): Promise<string> {
  const params: FetchParams = { countries, indicators, startYear, endYear };

  try {
    const rows = await fetchData(params);
    const batch = addBatch(label, params, rows);

    if (rows.length === 0) {
      return `データが見つかりませんでした。国コードや指標コードを確認してください。\n` +
        `パラメータ: 国=${countries.join(",")}, 指標=${indicators.join(",")}, 期間=${startYear}-${endYear}`;
    }

    const nonNull = rows.filter((r) => r.value !== null).length;
    const preview = rows
      .filter((r) => r.value !== null)
      .slice(0, 5)
      .map((r) => `  ${r.iso3} | ${r.year} | ${r.indicatorName} | ${r.value}`)
      .join("\n");

    return [
      `取得完了: ${rows.length}件 (有効値: ${nonNull}件)`,
      `バッチID: ${batch.id} (${label})`,
      `国: ${countries.join(", ")}`,
      `指標: ${indicators.join(", ")}`,
      `期間: ${startYear}-${endYear}`,
      ``,
      `先頭データ:`,
      preview,
    ].join("\n");
  } catch (e) {
    return `データ取得エラー: ${(e as Error).message}`;
  }
}
