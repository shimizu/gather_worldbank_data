/**
 * 国コード検索ツール。
 * World Bank API から国一覧を取得し、オプショナルなキーワードでフィルタする。
 */
import { listCountries } from "../wb-api.js";

export async function listCountriesTool(query?: string): Promise<string> {
  try {
    let countries = await listCountries();

    if (query) {
      const q = query.toLowerCase();
      countries = countries.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.region.toLowerCase().includes(q) ||
          c.incomeLevel.toLowerCase().includes(q)
      );
    }

    if (countries.length === 0) {
      return query
        ? `「${query}」に該当する国が見つかりませんでした。`
        : "国一覧の取得に失敗しました。";
    }

    const lines = countries.map(
      (c) => `- ${c.id}: ${c.name} [${c.region}] (${c.incomeLevel})`
    );

    const header = query
      ? `「${query}」に該当する国 (${countries.length}件):`
      : `国一覧 (${countries.length}件):`;

    return `${header}\n\n${lines.join("\n")}`;
  } catch (e) {
    return `国コード検索エラー: ${(e as Error).message}`;
  }
}
