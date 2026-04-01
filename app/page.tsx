"use client";

import { useState } from "react";
import LoginForm, { LoginData } from "@/components/LoginForm";
import ResultDisplay from "@/components/ResultDisplay";
import type { ValidationResult } from "@/lib/formatValidator";

export default function Home() {
  const [wpResult, setWpResult] = useState<ValidationResult | null>(null);
  const [serverResult, setServerResult] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async (data: { wp: LoginData; server: LoginData }) => {
    setIsLoading(true);
    setError(null);
    setWpResult(null);
    setServerResult(null);

    try {
      const promises = [];

      // Validate WP if URL is provided
      if (data.wp.url) {
        promises.push(
          fetch("/api/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data.wp, category: "wp" }),
          }).then(async (res) => {
            if (!res.ok) throw new Error("WordPressの検証中にエラーが発生しました");
            return { type: "wp", data: await res.json() };
          })
        );
      }

      // Validate Server if URL is provided
      if (data.server.url) {
        promises.push(
          fetch("/api/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data.server, category: "server" }),
          }).then(async (res) => {
            if (!res.ok) throw new Error("サーバー情報の検証中にエラーが発生しました");
            return { type: "server", data: await res.json() };
          })
        );
      }

      const results = await Promise.all(promises);
      results.forEach((r) => {
        if (r.type === "wp") setWpResult(r.data);
        if (r.type === "server") setServerResult(r.data);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "不明なエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            ログイン情報チェッカー
          </h1>
          <p className="text-gray-500">
            WordPress とサーバーのログイン情報を一括で検証・整理します
          </p>
        </div>

        {/* Form */}
        <LoginForm onSubmit={handleValidate} isLoading={isLoading} />

        {/* Error */}
        {error && (
          <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-center gap-3">
            <span className="font-bold">⚠️</span>
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="mt-12 flex flex-col items-center justify-center gap-4 py-12 bg-white rounded-3xl border border-dashed border-gray-200">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-gray-800 font-bold">検証中...</p>
              <p className="text-xs text-gray-400 mt-1">複数のシステムへ同時接続しています</p>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="space-y-12 mt-12 pb-20">
          {wpResult && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-6 bg-blue-500 rounded-full" />
                <h2 className="text-xl font-bold text-gray-800">WordPress の検証結果</h2>
              </div>
              <ResultDisplay result={wpResult} />
            </div>
          )}

          {serverResult && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-6 bg-slate-500 rounded-full" />
                <h2 className="text-xl font-bold text-gray-800">サーバー管理画面の検証結果</h2>
              </div>
              <ResultDisplay result={serverResult} />
            </div>
          )}
        </div>

        {/* Combined Global Report */}
        {(wpResult || serverResult) && (
          <div className="mt-16 bg-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-700">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">一括コピー用レポート（控え）</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    すべての検証済み情報をこちらのフォーマットでコピーできます
                  </p>
                </div>
                <button
                  onClick={() => {
                    const text = `＜作業に必要な情報＞

必要な情報a. ウェブサイトのアドレス
 ${wpResult?.url?.value || serverResult?.url?.value || "（※入力なし）"}

必要な情報b. レンタルサーバーの管理画面のログイン情報
 ${serverResult ? `管理画面のログイン　${serverResult.url.value}\n ユーザーID：${serverResult.userId.value}\n パスワード：${serverResult.password.value}` : "（※入力なし）"}

必要な情報c.  WordPressのダッシュボードのログイン情報
 ${wpResult ? `ダッシュボードのログイン　${wpResult.url.value}\n ユーザーID：${wpResult.userId.value}\n パスワード：${wpResult.password.value}` : "（※入力なし）"}

必要な情報d. 不具合についてヒント情報があれば共有をお願いします
 （ここに不具合の状況などを追記してください）
`;
                    navigator.clipboard.writeText(text);
                    alert("すべての情報をコピーしました");
                  }}
                  className="px-6 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-blue-50 transition-all shadow-lg active:scale-95"
                >
                  一括コピーする
                </button>
              </div>
              <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
                <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {`＜作業に必要な情報＞\n\n必要な情報a. ウェブサイトのアドレス\n ${wpResult?.url?.value || serverResult?.url?.value || "..."}\n\n... (一括コピーボタンで全情報が出力されます)`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
