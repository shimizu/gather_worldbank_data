/**
 * セッション内データストア。
 *
 * fetch_wb_data で取得したデータをメモリ上にバッチとして蓄積する。
 * export_csv / build_chart_site で全バッチを結合して出力する。
 * セッション終了時に破棄される（永続化しない）。
 */
import type { WbRow, FetchParams } from "./wb-api.js";

export interface DataBatch {
  id: string;
  label: string;
  params: FetchParams;
  rows: WbRow[];
  fetchedAt: string;
}

let batchCounter = 0;
const batches: DataBatch[] = [];

export function addBatch(label: string, params: FetchParams, rows: WbRow[]): DataBatch {
  batchCounter++;
  const batch: DataBatch = {
    id: `batch_${String(batchCounter).padStart(3, "0")}`,
    label,
    params,
    rows,
    fetchedAt: new Date().toISOString(),
  };
  batches.push(batch);
  return batch;
}

export function getAllBatches(): DataBatch[] {
  return batches;
}

export function getAllRows(): WbRow[] {
  return batches.flatMap((b) => b.rows);
}

export function clearStore(): void {
  batches.length = 0;
  batchCounter = 0;
}

export function getSummary(): string {
  const rows = getAllRows();
  if (rows.length === 0) return "データなし";

  const countries = new Set(rows.map((r) => r.iso3));
  const indicators = new Set(rows.map((r) => r.indicator));
  const years = rows.map((r) => r.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const nonNull = rows.filter((r) => r.value !== null).length;

  return [
    `バッチ数: ${batches.length}`,
    `総行数: ${rows.length} (有効値: ${nonNull})`,
    `国数: ${countries.size} (${[...countries].join(", ")})`,
    `指標数: ${indicators.size}`,
    `期間: ${minYear}-${maxYear}`,
  ].join("\n");
}
