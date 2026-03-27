import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchIndicators, listCountries, fetchData } from "../src/wb-api.js";

// global.fetch をモックしてAPI呼び出しをシミュレート
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

function jsonResponse(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  };
}

describe("searchIndicators", () => {
  it("検索結果を正しくパースする", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([
      { page: 1, pages: 1, total: 1 },
      [
        { id: "NY.GDP.MKTP.KD.ZG", name: "GDP growth (annual %)", sourceNote: "Annual GDP growth." },
      ],
    ]));

    const results = await searchIndicators("GDP growth");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("NY.GDP.MKTP.KD.ZG");
    expect(results[0].name).toBe("GDP growth (annual %)");
  });

  it("結果が空の場合は空配列を返す", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([
      { page: 1, pages: 0, total: 0 },
    ]));

    const results = await searchIndicators("nonexistent");
    expect(results).toHaveLength(0);
  });
});

describe("listCountries", () => {
  it("Aggregates を除外して国のみ返す", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([
      { page: 1, pages: 1, total: 2 },
      [
        { id: "JPN", name: "Japan", region: { value: "East Asia & Pacific" }, incomeLevel: { value: "High income" } },
        { id: "WLD", name: "World", region: { value: "Aggregates" }, incomeLevel: { value: "Aggregates" } },
      ],
    ]));

    const countries = await listCountries();
    expect(countries).toHaveLength(1);
    expect(countries[0].id).toBe("JPN");
  });
});

describe("fetchData", () => {
  it("データを正しく正規化する", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([
      { page: 1, pages: 1, total: 1 },
      [
        {
          country: { value: "Japan" },
          countryiso3code: "JPN",
          indicator: { id: "FP.CPI.TOTL.ZG", value: "Inflation (annual %)" },
          date: "2023",
          value: 3.2,
        },
      ],
    ]));

    const rows = await fetchData({
      countries: ["JPN"],
      indicators: ["FP.CPI.TOTL.ZG"],
      startYear: 2023,
      endYear: 2023,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      country: "Japan",
      iso3: "JPN",
      indicator: "FP.CPI.TOTL.ZG",
      indicatorName: "Inflation (annual %)",
      year: 2023,
      value: 3.2,
    });
  });

  it("複数指標を1つずつ取得してマージする", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse([
        { page: 1, pages: 1 },
        [{ country: { value: "Japan" }, countryiso3code: "JPN", indicator: { id: "A", value: "A" }, date: "2023", value: 1 }],
      ]))
      .mockResolvedValueOnce(jsonResponse([
        { page: 1, pages: 1 },
        [{ country: { value: "Japan" }, countryiso3code: "JPN", indicator: { id: "B", value: "B" }, date: "2023", value: 2 }],
      ]));

    const rows = await fetchData({
      countries: ["JPN"],
      indicators: ["A", "B"],
      startYear: 2023,
      endYear: 2023,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].indicator).toBe("A");
    expect(rows[1].indicator).toBe("B");
  });
});
