import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ログイン情報チェッカー",
  description:
    "クライアントから受け取ったWordPress・サーバーのログイン情報を検証するツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
