/**
 * Anthropic API 接続テスト用スクリプト。
 * 実行: npx tsx test-connection.ts
 */
import Anthropic from "@anthropic-ai/sdk";

async function main() {
  console.log("1. ANTHROPIC_API_KEY チェック...");
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("   ❌ ANTHROPIC_API_KEY が未設定です");
    process.exit(1);
  }
  console.log("   ✅ 設定済み");

  console.log("\n2. Claude API に接続中...");
  const client = new Anthropic();

  try {
    const res = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 50,
      messages: [{ role: "user", content: "Say 'Hello' in Japanese. Reply in one word only." }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    console.log(`   ✅ 応答: "${text}"`);
    console.log(`   モデル: ${res.model}`);
    console.log(`   トークン: input=${res.usage.input_tokens}, output=${res.usage.output_tokens}`);
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error(`   ❌ エラー: ${err.status ?? ""} ${err.message}`);
    process.exit(1);
  }

  console.log("\n✅ 接続テスト成功!");
}

main();
