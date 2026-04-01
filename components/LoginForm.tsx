"use client";

import { useState } from "react";

export interface LoginData {
  url: string;
  userId: string;
  password: string;
}

interface LoginFormProps {
  onSubmit: (data: { wp: LoginData; server: LoginData }) => void;
  isLoading: boolean;
}

export default function LoginForm({ onSubmit, isLoading }: LoginFormProps) {
  const [wp, setWp] = useState<LoginData>({ url: "", userId: "", password: "" });
  const [server, setServer] = useState<LoginData>({ url: "", userId: "", password: "" });
  const [showWpPass, setShowWpPass] = useState(false);
  const [showServerPass, setShowServerPass] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ wp, server });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden"
    >
      <div className="p-8 space-y-10">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-4">
          情報の入力
        </h2>

        {/* Section 1: WordPress */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
              1
            </span>
            <h3 className="font-bold text-gray-800">
              WordPressのログイン情報
            </h3>
          </div>
          
          <div className="grid gap-6 pl-11">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">
                ダッシュボードのログインURL
              </label>
              <input
                type="text"
                value={wp.url}
                onChange={(e) => setWp({ ...wp, url: e.target.value })}
                placeholder="https://○○/wp-admin/"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-900"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">
                  ユーザーID
                </label>
                <input
                  type="text"
                  value={wp.userId}
                  onChange={(e) => setWp({ ...wp, userId: e.target.value })}
                  placeholder="ユーザー名を入力"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-900"
                />
              </div>
              <div className="space-y-1 relative">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">
                  パスワード
                </label>
                <div className="relative">
                  <input
                    type={showWpPass ? "text" : "password"}
                    value={wp.password}
                    onChange={(e) => setWp({ ...wp, password: e.target.value })}
                    placeholder="パスワードを入力"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm pr-20 text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWpPass(!showWpPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-widest bg-white px-2 py-1 rounded"
                  >
                    {showWpPass ? "隠す" : "表示"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Server Panel */}
        <div className="space-y-6 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
              2
            </span>
            <h3 className="font-bold text-gray-800">
              レンタルサーバーの管理画面
            </h3>
          </div>
          
          <div className="grid gap-6 pl-11">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">
                管理画面のログインURL
              </label>
              <input
                type="text"
                value={server.url}
                onChange={(e) => setServer({ ...server, url: e.target.value })}
                placeholder="https://panel.xserver.ne.jp/"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-900"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">
                  ユーザーID
                </label>
                <input
                  type="text"
                  value={server.userId}
                  onChange={(e) => setServer({ ...server, userId: e.target.value })}
                  placeholder="ユーザーIDを入力"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-900"
                />
              </div>
              <div className="space-y-1 relative">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">
                  パスワード
                </label>
                <div className="relative">
                  <input
                    type={showServerPass ? "text" : "password"}
                    value={server.password}
                    onChange={(e) => setServer({ ...server, password: e.target.value })}
                    placeholder="パスワードを入力"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm pr-20 text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowServerPass(!showServerPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-widest bg-white px-2 py-1 rounded"
                  >
                    {showServerPass ? "隠す" : "表示"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-6">
          <button
            type="submit"
            disabled={isLoading || (!wp.url && !server.url)}
            className="w-full bg-blue-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
          >
            {isLoading ? "一括検証中..." : "ログイン情報を検証する"}
          </button>
        </div>
      </div>
    </form>
  );
}
