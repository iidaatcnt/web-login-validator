"use client";

import { useState } from "react";
import type { ValidationResult } from "@/lib/formatValidator";

interface ResultDisplayProps {
  result: ValidationResult;
}

function StatusBadge({ ok, warnings }: { ok: boolean; warnings: string[] }) {
  if (ok && warnings.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 text-xs font-medium">
        ✅ OK
      </span>
    );
  }
  if (!ok) {
    return (
      <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 text-xs font-medium">
        ❌ エラー
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5 text-xs font-medium">
      ⚠️ 警告
    </span>
  );
}

function IssueList({
  errors,
  warnings,
}: {
  errors: string[];
  warnings: string[];
}) {
  if (errors.length === 0 && warnings.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {errors.map((e, i) => (
        <p key={`e-${i}`} className="text-xs text-red-600 flex gap-1">
          <span className="shrink-0">❌</span>
          <span>{e}</span>
        </p>
      ))}
      {warnings.map((w, i) => (
        <p key={`w-${i}`} className="text-xs text-yellow-700 flex gap-1">
          <span className="shrink-0">⚠️</span>
          <span>{w}</span>
        </p>
      ))}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
        copied
          ? "bg-green-50 border-green-300 text-green-700"
          : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"
      }`}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          コピー完了
        </>
      ) : (
        <>
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          {label ?? "コピー"}
        </>
      )}
    </button>
  );
}

function connectionStatusLabel(code: string): { label: string; ok: boolean } {
  switch (code) {
    case "LOGIN_SUCCESS":
      return { label: "✅ 成功", ok: true };
    case "SKIPPED":
      return { label: "⏭️ スキップ（汎用サイト）", ok: true };
    case "AUTH_FAILED":
      return { label: "❌ 失敗（認証エラー）", ok: false };
    case "MFA_REQUIRED":
      return { label: "⚠️ 多要素認証が必要", ok: false };
    case "LOGIN_PAGE_NOT_FOUND":
      return { label: "❌ ログインページ未検出", ok: false };
    case "URL_NOT_FOUND":
      return { label: "❌ URLが見つかりません", ok: false };
    default:
      return { label: "不明", ok: false };
  }
}

export default function ResultDisplay({ result }: ResultDisplayProps) {
  const {
    url,
    userId,
    password,
    siteType,
    connection,
    overallOk,
    clientMessage,
    formattedSummary,
  } = result;

  const [showClearTextSummary, setShowClearTextSummary] = useState(true);

  const maskedPassword = password.value
    ? "*".repeat(Math.min(password.value.length, 12))
    : "";

  // Generate a clear-text version of the formatted summary
  const clearTextSummary = formattedSummary.replace(/\*{4,}/g, password.value || "");

  const loginStatus = connectionStatusLabel(connection.loginStatus);

  return (
    <div className="mt-6 space-y-4">
      {/* Overall status banner */}
      <div
        className={`rounded-lg p-4 border ${
          overallOk
            ? "bg-green-50 border-green-200"
            : "bg-red-50 border-red-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{overallOk ? "✅" : "❌"}</span>
          <p
            className={`font-semibold ${
              overallOk ? "text-green-800" : "text-red-800"
            }`}
          >
            {overallOk
              ? "ログイン情報の検証が完了しました（問題なし）"
              : "ログイン情報に問題が検出されました"}
          </p>
        </div>
      </div>

      {/* Detail card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">
            ログイン情報チェック結果
          </h3>
        </div>

        <div className="p-5 space-y-4">
          {/* Field table */}
          <div className="divide-y divide-gray-100">
            {/* URL row */}
            <div className="py-3 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 mb-0.5">
                    ログインURL
                  </p>
                  <p className="text-sm text-gray-900 break-all font-mono">
                    {url.value || "（未入力）"}
                  </p>
                  <IssueList errors={url.errors} warnings={url.warnings} />
                </div>
                <StatusBadge ok={url.ok} warnings={url.warnings} />
              </div>
            </div>

            {/* User ID row */}
            <div className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 mb-0.5">
                    ユーザID
                  </p>
                  <p className="text-sm text-gray-900 font-mono">
                    {userId.value || "（未入力）"}
                  </p>
                  <IssueList
                    errors={userId.errors}
                    warnings={userId.warnings}
                  />
                </div>
                <StatusBadge ok={userId.ok} warnings={userId.warnings} />
              </div>
            </div>

            {/* Password row */}
            <div className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 mb-0.5">
                    パスワード
                  </p>
                  <p className="text-sm text-gray-900 font-mono tracking-widest">
                    {maskedPassword || "（未入力）"}
                  </p>
                  <IssueList
                    errors={password.errors}
                    warnings={password.warnings}
                  />
                </div>
                <StatusBadge ok={password.ok} warnings={password.warnings} />
              </div>
            </div>

            {/* Site type row */}
            <div className="py-3">
              <p className="text-xs font-medium text-gray-500 mb-0.5">種別</p>
              <p className="text-sm text-gray-900">{siteType}</p>
            </div>
          </div>

          {/* Connection result */}
          <div className="pt-2 border-t border-gray-200 space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              接続確認
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">URL到達</p>
                <p className="text-sm font-medium">
                  {connection.reachable ? "✅ 到達可能" : "❌ 到達不可"}
                  {connection.sslWarning && (
                    <span className="ml-2 text-xs text-yellow-600 font-normal">
                      ⚠️ SSL警告
                    </span>
                  )}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">ログイン</p>
                <p
                  className={`text-sm font-medium ${
                    loginStatus.ok ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {loginStatus.label}
                </p>
              </div>
            </div>
            {connection.detail && (
              <p className="text-xs text-gray-500 mt-1">{connection.detail}</p>
            )}
          </div>
        </div>
      </div>

      {/* Text Formatted Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-700">テキスト形式サマリー</h3>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-200 px-2 py-1 rounded cursor-pointer hover:bg-gray-300 transition-colors">
              <input
                type="checkbox"
                checked={showClearTextSummary}
                onChange={(e) => setShowClearTextSummary(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              <span>パスワードを表示してコピーする</span>
            </label>
          </div>
          <CopyButton 
            text={showClearTextSummary ? clearTextSummary : formattedSummary} 
            label="サマリーをコピー" 
          />
        </div>
        <pre className="p-5 text-xs font-mono text-gray-800 whitespace-pre-wrap overflow-x-auto leading-relaxed">
          {showClearTextSummary ? clearTextSummary : formattedSummary}
        </pre>
      </div>

      {/* Client re-request message */}
      {clientMessage && (
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-amber-800">
                クライアントへの再送依頼文
              </h3>
              <p className="text-xs text-amber-600 mt-0.5">
                問題が検出されました。以下の文章をコピーしてクライアントに送付してください
              </p>
            </div>
            <CopyButton text={clientMessage} label="文章をコピー" />
          </div>
          <div className="p-5">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-sans">
              {clientMessage}
            </pre>
          </div>
        </div>
      )}

      {/* Internal Copy Section */}
      <div className="bg-gray-100 rounded-xl shadow-inner border border-gray-200 overflow-hidden mt-8 mb-8">
        <div className="px-5 py-4 bg-gray-200 border-b border-gray-300 flex items-center justify-between">
          <div className="pr-4">
            <h3 className="text-sm font-bold text-gray-700">作業用レポート（情報控え）</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">※自分への記録用として、ここからは**パスワードを含めて**コピーできます</p>
          </div>
          <button
            onClick={() => {
              const text = `＜作業に必要な情報＞

必要な情報a. ウェブサイトのアドレス
 ${url.value}

必要な情報b. レンタルサーバーの管理画面のログイン情報
 ${siteType.includes("パネル") ? `管理画面のログイン　${url.value}\n ユーザーID：${userId.value}\n パスワード：${password.value}` : "（※別途入力）"}

必要な情報c.  WordPressのダッシュボードのログイン情報
 ${siteType === "WordPress管理画面" ? `ダッシュボードのログイン　${url.value}\n ユーザーID：${userId.value}\n パスワード：${password.value}` : "（※別途入力）"}

必要な情報d. 不具合についてヒント情報があれば共有をお願いします
 （ここに記入）
`;
              navigator.clipboard.writeText(text);
              alert("レポートをコピーしました（パスワードを含みます）");
            }}
            className="px-4 py-2 bg-slate-700 text-white rounded shadow-sm text-sm hover:bg-black transition-colors whitespace-nowrap"
          >
            パスワードを含めてコピー
          </button>
        </div>
        <div className="p-5">
          <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap leading-relaxed py-2 italic font-sans">
            {`＜作業に必要な情報＞\n\n必要な情報a. ウェブサイトのアドレス\n ${url.value}\n\n... (コピーボタンでパスワードを含む全情報がクリップボードに保存されます)`}
          </pre>
        </div>
      </div>
    </div>
  );
}
