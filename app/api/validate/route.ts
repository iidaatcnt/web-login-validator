import { NextRequest, NextResponse } from "next/server";
import {
  validateUrl,
  validateUserId,
  validatePassword,
  detectSiteType,
  generateClientMessage,
  formatSummary,
  type ValidationResult,
  type ConnectionResult,
} from "@/lib/formatValidator";
import { validateConnection } from "@/lib/connectionValidator";

export const runtime = "nodejs"; // Must use Node.js runtime for https module

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { url?: string; userId?: string; password?: string; category?: "wp" | "server" };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "リクエストボディのパースに失敗しました" },
      { status: 400 }
    );
  }

  const rawUrl = (body.url ?? "").trim();
  const rawUserId = (body.userId ?? "").trim();
  const rawPassword = body.password ?? "";
  const category = body.category;

  // ── Format validation ──────────────────────────────────────
  const urlValidation = validateUrl(rawUrl);
  const userIdValidation = validateUserId(rawUserId);
  const passwordValidation = validatePassword(rawPassword);

  // ── Site type detection ────────────────────────────────────
  let siteType = detectSiteType(urlValidation.value || rawUrl);
  
  // Use category hint if available
  if (category === "wp") {
    siteType = "WordPress管理画面";
  } else if (category === "server") {
    // If it's the server section but detection says generic, hint at Xserver
    if (siteType === "不明（汎用サイト）") {
      siteType = "Xserverコントロールパネル";
    }
  }

  // ── Connection validation (only if format is OK) ──────────
  let connection: ConnectionResult = {
    reachable: false,
    sslWarning: false,
    loginStatus: "SKIPPED",
    detail: "フォーマットエラーのため接続チェックをスキップしました",
  };

  const formatOk =
    urlValidation.ok && userIdValidation.ok && passwordValidation.ok;

  if (formatOk) {
    try {
      connection = await validateConnection(
        urlValidation.value,
        rawUserId,
        rawPassword,
        siteType
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      connection = {
        reachable: false,
        sslWarning: false,
        loginStatus: "URL_NOT_FOUND",
        detail: `接続チェック中に予期しないエラーが発生しました: ${msg}`,
      };
    }
  }

  // ── Determine overall result ───────────────────────────────
  const connectionOk =
    connection.reachable &&
    (connection.loginStatus === "LOGIN_SUCCESS" ||
      connection.loginStatus === "SKIPPED");

  const overallOk = formatOk && connectionOk;

  // ── Generate client message if needed ─────────────────────
  const clientMessage = generateClientMessage(
    urlValidation,
    userIdValidation,
    passwordValidation,
    connection
  );

  // ── Format summary ─────────────────────────────────────────
  const formattedSummary = formatSummary(
    urlValidation,
    userIdValidation,
    passwordValidation,
    siteType,
    connection
  );

  const result: ValidationResult = {
    url: urlValidation,
    userId: userIdValidation,
    password: passwordValidation,
    siteType,
    connection,
    overallOk,
    clientMessage,
    formattedSummary,
  };

  return NextResponse.json(result, { status: 200 });
}
