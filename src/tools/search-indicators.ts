/**
 * 指標検索ツール。
 * World Bank API の Indicator 検索エンドポイントで WDI 指標を検索する。
 */
import { searchIndicators } from "../wb-api.js";

export async function searchIndicatorsTool(query: string): Promise<string> {
  try {
    const results = await searchIndicators(query, 20);

    if (results.length === 0) {
      return `「${query}」に該当する指標が見つかりませんでした。別のキーワードで試してください。`;
    }

    const lines = results.map((r) => {
      const note = r.sourceNote.length > 100
        ? r.sourceNote.slice(0, 100) + "..."
        : r.sourceNote;
      return `- ${r.id}: ${r.name}\n  ${note}`;
    });

    return `「${query}」の検索結果 (${results.length}件):\n\n${lines.join("\n\n")}`;
  } catch (e) {
    return `指標検索エラー: ${(e as Error).message}`;
  }
}
