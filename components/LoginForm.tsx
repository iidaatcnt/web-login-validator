"use client";

import { useState } from "react";

interface LoginFormProps {
  onSubmit: (data: {
    url: string;
    userId: string;
    password: string;
  }) => Promise<void>;
  isLoading: boolean;
}

export default function LoginForm({ onSubmit, isLoading }: LoginFormProps) {
  const [url, setUrl] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Suggest https:// if user tabs out of URL field without a scheme
  const handleUrlBlur = () => {
    if (url && !/^https?:\/\//i.test(url)) {
      const domain = url.trim();
      if (/^[\w.-]+\.\w+/.test(domain)) {
        setUrl(`https://${domain}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ url, userId, password });
  };

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white text-gray-900 placeholder-gray-400";

  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-800 mb-5">
        ログイン情報を入力
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* URL */}
        <div>
          <label htmlFor="url" className={labelClass}>
            ログインURL
            <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={handleUrlBlur}
            placeholder="https://example.com/wp-admin"
            className={inputClass}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1 text-xs text-gray-400">
            http:// または https:// から始まるURLを入力してください
          </p>
        </div>

        {/* User ID */}
        <div>
          <label htmlFor="userId" className={labelClass}>
            ユーザID
            <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            id="userId"
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="admin"
            className={inputClass}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className={labelClass}>
            パスワード
            <span className="ml-1 text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              className={`${inputClass} pr-20`}
              autoComplete="new-password"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? "隠す" : "表示"}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !url || !userId || !password}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              検証中...
            </>
          ) : (
            "ログイン情報を検証する"
          )}
        </button>
      </form>
    </div>
  );
}
