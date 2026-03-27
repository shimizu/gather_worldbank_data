/**
 * World Bank データ取得 AIエージェント CLI エントリポイント。
 *
 * 対話形式でユーザーの指示を受け取り、エージェントに渡す。
 * 実行: npm start (= tsx src/wb-cli.ts)
 */
import readline from "node:readline";
import { runAgent } from "./wb-agent.js";
import { clearStore } from "./wb-store.js";

clearStore();

console.log("=== World Bank データ取得 AIエージェント ===");
console.log("自然言語でデータ取得の指示を入力してください。");
console.log('例: 「イラン戦争の経済的影響を調べたい。関連データをダウンロードして可視化して」');
console.log('終了: "exit"\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(): void {
  rl.question("> ", async (input) => {
    const trimmed = input.trim();

    if (!trimmed) {
      prompt();
      return;
    }

    if (trimmed === "exit" || trimmed === "quit") {
      console.log("終了します。");
      rl.close();
      return;
    }

    try {
      console.log("");
      const result = await runAgent(trimmed);
      console.log(`\n${result}\n`);
    } catch (e) {
      const err = e as Error;
      if (err.message?.includes("API key")) {
        console.error(
          "\n[エラー] ANTHROPIC_API_KEY が設定されていません。\n" +
            "  export ANTHROPIC_API_KEY=sk-ant-...\n",
        );
      } else {
        console.error(`\n[エラー] ${err.message}\n`);
      }
    }

    prompt();
  });
}

prompt();
