"use client";

import { useState } from "react";
import LoginForm from "@/components/LoginForm";
import ResultDisplay from "@/components/ResultDisplay";
import type { ValidationResult } from "@/lib/formatValidator";

export default function Home() {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async (data: {
    url: string;
    userId: string;
    password: string;
  }) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTPエラー: ${response.status}`);
      }

      const json: ValidationResult = await response.json();
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "不明なエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            ログイン情報チェッカー
          </h1>
          <p className="text-sm text-gray-500">
            クライアントから受け取ったログイン情報のフォーマット・接続を検証します
          </p>
        </div>

        {/* Form */}
        <LoginForm onSubmit={handleValidate} isLoading={isLoading} />

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <span className="font-semibold">エラー: </span>
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="mt-6 flex items-center justify-center gap-3 py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-600 text-sm">検証中...</span>
          </div>
        )}

        {/* Result */}
        {result && !isLoading && <ResultDisplay result={result} />}
      </div>
    </main>
  );
}
