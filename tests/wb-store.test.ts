import { describe, it, expect, beforeEach } from "vitest";
import { addBatch, getAllBatches, getAllRows, clearStore, getSummary } from "../src/wb-store.js";

beforeEach(() => {
  clearStore();
});

describe("wb-store", () => {
  const sampleParams = {
    countries: ["JPN", "USA"],
    indicators: ["NY.GDP.MKTP.KD.ZG"],
    startYear: 2020,
    endYear: 2023,
  };

  const sampleRows = [
    { country: "Japan", iso3: "JPN", indicator: "NY.GDP.MKTP.KD.ZG", indicatorName: "GDP growth (annual %)", year: 2020, value: -4.3 },
    { country: "Japan", iso3: "JPN", indicator: "NY.GDP.MKTP.KD.ZG", indicatorName: "GDP growth (annual %)", year: 2021, value: 2.1 },
    { country: "United States", iso3: "USA", indicator: "NY.GDP.MKTP.KD.ZG", indicatorName: "GDP growth (annual %)", year: 2020, value: -2.8 },
    { country: "United States", iso3: "USA", indicator: "NY.GDP.MKTP.KD.ZG", indicatorName: "GDP growth (annual %)", year: 2021, value: 5.9 },
  ];

  it("addBatch でバッチを追加し getAllBatches で取得できる", () => {
    const batch = addBatch("テスト", sampleParams, sampleRows);
    expect(batch.id).toBe("batch_001");
    expect(batch.label).toBe("テスト");
    expect(getAllBatches()).toHaveLength(1);
  });

  it("getAllRows で全バッチの行を結合できる", () => {
    addBatch("バッチ1", sampleParams, sampleRows.slice(0, 2));
    addBatch("バッチ2", sampleParams, sampleRows.slice(2));
    expect(getAllRows()).toHaveLength(4);
  });

  it("clearStore でストアを空にできる", () => {
    addBatch("テスト", sampleParams, sampleRows);
    clearStore();
    expect(getAllBatches()).toHaveLength(0);
    expect(getAllRows()).toHaveLength(0);
  });

  it("getSummary でデータなしの場合", () => {
    expect(getSummary()).toBe("データなし");
  });

  it("getSummary でデータありの場合", () => {
    addBatch("テスト", sampleParams, sampleRows);
    const summary = getSummary();
    expect(summary).toContain("総行数: 4");
    expect(summary).toContain("国数: 2");
    expect(summary).toContain("JPN");
    expect(summary).toContain("USA");
  });

  it("複数 addBatch でバッチIDが連番になる", () => {
    const b1 = addBatch("1", sampleParams, []);
    const b2 = addBatch("2", sampleParams, []);
    expect(b1.id).toBe("batch_001");
    expect(b2.id).toBe("batch_002");
  });
});
