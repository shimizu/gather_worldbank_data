/**
 * CSV出力ツール。
 * wb-store の全バッチデータを結合してCSVファイルに出力する。
 * メタデータJSONも同時に出力する。
 */
import fs from "node:fs";
import path from "node:path";
import { getAllRows, getAllBatches, getSummary } from "../wb-store.js";

const OUT_DIR = path.resolve(import.meta.dirname, "../../out");

export function exportCsvTool(filename: string): string {
  const rows = getAllRows();

  if (rows.length === 0) {
    return "出力するデータがありません。先に fetch_wb_data でデータを取得してください。";
  }

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const date = new Date().toISOString().split("T")[0];
  const baseName = `${filename}_${date}`;

  // CSV出力
  const header = "country,iso3,indicator,indicator_name,year,value";
  const lines = rows.map((r) => {
    const escapedName = r.indicatorName.includes(",")
      ? `"${r.indicatorName}"`
      : r.indicatorName;
    return `${r.country},${r.iso3},${r.indicator},${escapedName},${r.year},${r.value ?? ""}`;
  });
  const csv = [header, ...lines].join("\n");
  const csvPath = path.join(OUT_DIR, `${baseName}.csv`);
  fs.writeFileSync(csvPath, csv, "utf-8");

  // メタデータJSON出力
  const meta = {
    generatedAt: new Date().toISOString(),
    filename: `${baseName}.csv`,
    totalRows: rows.length,
    summary: getSummary(),
    batches: getAllBatches().map((b) => ({
      id: b.id,
      label: b.label,
      params: b.params,
      rowCount: b.rows.length,
      fetchedAt: b.fetchedAt,
    })),
  };
  const metaPath = path.join(OUT_DIR, `${baseName}_meta.json`);
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");

  return `出力完了:\n- CSV: ${csvPath} (${rows.length}行)\n- メタデータ: ${metaPath}`;
}
