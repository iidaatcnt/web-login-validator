// ============================================================
// Type definitions shared across client and server
// ============================================================

export type SiteType =
  | "WordPress管理画面"
  | "Xserverコントロールパネル"
  | "さくらインターネット コントロールパネル"
  | "不明（汎用サイト）";

export type ConnectionErrorCode =
  | "URL_NOT_FOUND"
  | "LOGIN_PAGE_NOT_FOUND"
  | "AUTH_FAILED"
  | "MFA_REQUIRED"
  | "LOGIN_SUCCESS"
  | "SKIPPED"
  | "SSL_WARNING";

export interface FieldValidation {
  value: string;
  warnings: string[];
  errors: string[];
  ok: boolean;
}

export interface ConnectionResult {
  reachable: boolean;
  sslWarning: boolean;
  loginStatus: ConnectionErrorCode;
  detail: string;
}

export interface ValidationResult {
  url: FieldValidation;
  userId: FieldValidation;
  password: FieldValidation;
  siteType: SiteType;
  connection: ConnectionResult;
  overallOk: boolean;
  clientMessage: string | null;
  formattedSummary: string;
}

// ============================================================
// Full-width character detection
// ============================================================

export function hasFullWidthChars(str: string): boolean {
  // Unicode ranges for full-width / CJK characters that are suspicious in credentials
  // Full-width ASCII variants: U+FF01–U+FF60
  // Full-width digits/letters: included in above range
  return /[\uFF01-\uFF60\uFFE0-\uFFE6]/.test(str);
}

export function hasLeadingOrTrailingSpaces(str: string): boolean {
  return str !== str.trim();
}

export function hasControlChars(str: string): boolean {
  // Detect non-printable / control characters (except normal whitespace already caught)
  // eslint-disable-next-line no-control-regex
  return /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(str);
}

// ============================================================
// URL validation
// ============================================================

export function validateUrl(raw: string): FieldValidation {
  const warnings: string[] = [];
  const errors: string[] = [];
  let value = raw;

  if (!value) {
    errors.push("ログインURLが入力されていません");
    return { value, warnings, errors, ok: false };
  }

  // Detect and suggest autocomplete for missing scheme
  if (!/^https?:\/\//i.test(value)) {
    // If it looks like a domain, suggest https://
    if (/^[\w.-]+\.\w+/.test(value)) {
      warnings.push(
        `URLにスキームが含まれていません。「https://${value}」として扱います`
      );
      value = `https://${value}`;
    } else {
      errors.push(
        'URLは「http://」または「https://」で始まる必要があります'
      );
      return { value, warnings, errors, ok: false };
    }
  }

  // Full-width characters in URL
  if (hasFullWidthChars(value)) {
    errors.push(
      "URLに全角文字が含まれています。半角文字のみで入力してください"
    );
  }

  // Leading/trailing spaces
  if (hasLeadingOrTrailingSpaces(raw)) {
    warnings.push("URLの前後にスペースが含まれています（自動で除去しました）");
    value = value.trim();
  }

  // Control characters
  if (hasControlChars(value)) {
    errors.push("URLに制御文字が含まれています");
  }

  // Basic URL structure check
  try {
    new URL(value);
  } catch {
    errors.push("URLの形式が正しくありません");
  }

  const ok = errors.length === 0;
  return { value: value.trim(), warnings, errors, ok };
}

// ============================================================
// User ID validation
// ============================================================

export function validateUserId(raw: string): FieldValidation {
  const warnings: string[] = [];
  const errors: string[] = [];
  let value = raw;

  if (!value) {
    errors.push("ユーザIDが入力されていません");
    return { value, warnings, errors, ok: false };
  }

  if (hasLeadingOrTrailingSpaces(value)) {
    warnings.push(
      "ユーザIDの前後にスペースが含まれています（コピー時にスペースが混入している可能性があります）"
    );
  }

  if (hasFullWidthChars(value)) {
    errors.push(
      "ユーザIDに全角文字が含まれています。半角英数字で入力してください"
    );
  }

  if (hasControlChars(value)) {
    errors.push("ユーザIDに制御文字が含まれています");
  }

  value = raw; // keep original for display; don't auto-trim (show the issue)
  const ok = errors.length === 0;
  return { value, warnings, errors, ok };
}

// ============================================================
// Password validation
// ============================================================

export function validatePassword(raw: string): FieldValidation {
  const warnings: string[] = [];
  const errors: string[] = [];
  const value = raw;

  if (!value) {
    errors.push("パスワードが入力されていません");
    return { value, warnings, errors, ok: false };
  }

  if (hasLeadingOrTrailingSpaces(value)) {
    warnings.push(
      "パスワードの前後にスペースが含まれています（コピー時にスペースが混入している可能性があります）"
    );
  }

  if (hasFullWidthChars(value)) {
    errors.push(
      "パスワードに全角文字が含まれています。半角文字のみで入力してください"
    );
  }

  if (hasControlChars(value)) {
    errors.push("パスワードに制御文字が含まれています");
  }

  const ok = errors.length === 0;
  return { value, warnings, errors, ok };
}

// ============================================================
// Site type detection
// ============================================================

export function detectSiteType(url: string): SiteType {
  try {
    const parsed = new URL(url);
    const full = parsed.href.toLowerCase();
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host.includes("panel.xserver.ne.jp") || host.includes("secure.xserver.ne.jp")) {
      return "Xserverコントロールパネル";
    }
    if (host.includes("secure.sakura.ad.jp")) {
      return "さくらインターネット コントロールパネル";
    }
    if (
      path.includes("/wp-admin") ||
      path.includes("/wp-login.php") ||
      full.includes("wp-admin") ||
      full.includes("wp-login.php")
    ) {
      return "WordPress管理画面";
    }
    return "不明（汎用サイト）";
  } catch {
    return "不明（汎用サイト）";
  }
}

// ============================================================
// Client re-request message generator
// ============================================================

export function generateClientMessage(
  urlValidation: FieldValidation,
  userIdValidation: FieldValidation,
  passwordValidation: FieldValidation,
  connection: ConnectionResult
): string | null {
  const issues: string[] = [];

  // Collect all errors and warnings
  [...urlValidation.errors, ...urlValidation.warnings].forEach((e) =>
    issues.push(`ログインURL: ${e}`)
  );
  [...userIdValidation.errors, ...userIdValidation.warnings].forEach((e) =>
    issues.push(`ユーザID: ${e}`)
  );
  [...passwordValidation.errors, ...passwordValidation.warnings].forEach((e) =>
    issues.push(`パスワード: ${e}`)
  );

  if (!connection.reachable) {
    issues.push(`接続確認: ${connection.detail}`);
  } else if (
    connection.loginStatus === "AUTH_FAILED" ||
    connection.loginStatus === "LOGIN_PAGE_NOT_FOUND"
  ) {
    issues.push(`ログイン確認: ${connection.detail}`);
  } else if (connection.loginStatus === "MFA_REQUIRED") {
    issues.push(`ログイン確認: ${connection.detail}`);
  }

  if (issues.length === 0) {
    return null;
  }

  const issueList = issues.map((i) => `・${i}`).join("\n");

  return `お世話になっております。
ご提供いただいたログイン情報を確認しましたが、以下の点で問題が発生しています。

【確認が必要な項目】
${issueList}

お手数ですが、以下の形式で再度ご共有をお願いいたします。

■ ログインURL  : （例: https://example.com/wp-admin）
■ ユーザID    :
■ パスワード   :

よろしくお願いいたします。`;
}

// ============================================================
// Summary formatter
// ============================================================

export function formatSummary(
  urlVal: FieldValidation,
  userIdVal: FieldValidation,
  passwordVal: FieldValidation,
  siteType: SiteType,
  connection: ConnectionResult
): string {
  const icon = (ok: boolean) => (ok ? "✅" : "❌");
  const connIcon = connection.reachable ? "✅" : "❌";
  const loginIcon =
    connection.loginStatus === "LOGIN_SUCCESS"
      ? "✅"
      : connection.loginStatus === "SKIPPED"
      ? "⏭️"
      : connection.loginStatus === "SSL_WARNING"
      ? "⚠️"
      : "❌";

  const urlDisplay = urlVal.value || "（未入力）";
  const userDisplay = userIdVal.value || "（未入力）";
  const passDisplay = passwordVal.value
    ? "*".repeat(Math.min(passwordVal.value.length, 12))
    : "（未入力）";

  // Pad strings for alignment
  const pad = (str: string, len: number) =>
    str + " ".repeat(Math.max(0, len - Array.from(str).length));

  const lines = [
    "============================",
    " ログイン情報チェック結果",
    "============================",
    `ログインURL : ${pad(urlDisplay, 40)} ${icon(urlVal.ok)}`,
    `ユーザID   : ${pad(userDisplay, 40)} ${icon(userIdVal.ok)}`,
    `パスワード  : ${pad(passDisplay, 40)} ${icon(passwordVal.ok)}`,
    `種別       : ${siteType}`,
    "----------------------------",
    `接続確認   : ${connIcon} ${connection.reachable ? "到達可能" : "到達不可"}${
      connection.sslWarning ? "（SSL警告あり）" : ""
    }`,
    `ログイン   : ${loginIcon} ${loginStatusLabel(connection.loginStatus)}`,
    "============================",
  ];

  // Append issues if any
  const allWarnings = [
    ...urlVal.warnings.map((w) => `⚠️  URL: ${w}`),
    ...userIdVal.warnings.map((w) => `⚠️  ユーザID: ${w}`),
    ...passwordVal.warnings.map((w) => `⚠️  パスワード: ${w}`),
  ];
  const allErrors = [
    ...urlVal.errors.map((e) => `❌ URL: ${e}`),
    ...userIdVal.errors.map((e) => `❌ ユーザID: ${e}`),
    ...passwordVal.errors.map((e) => `❌ パスワード: ${e}`),
  ];

  if (allErrors.length > 0 || allWarnings.length > 0) {
    lines.push("");
    lines.push("【検出された問題】");
    allErrors.forEach((e) => lines.push(e));
    allWarnings.forEach((w) => lines.push(w));
  }

  if (connection.detail) {
    lines.push("");
    lines.push(`【接続詳細】`);
    lines.push(connection.detail);
  }

  return lines.join("\n");
}

function loginStatusLabel(code: ConnectionErrorCode): string {
  switch (code) {
    case "LOGIN_SUCCESS":
      return "成功";
    case "AUTH_FAILED":
      return "失敗（認証エラー）";
    case "MFA_REQUIRED":
      return "多要素認証が必要";
    case "LOGIN_PAGE_NOT_FOUND":
      return "ログインページが見つかりません";
    case "URL_NOT_FOUND":
      return "URLが見つかりません";
    case "SKIPPED":
      return "スキップ（汎用サイト）";
    case "SSL_WARNING":
      return "SSL証明書に問題あり（警告）";
    default:
      return "不明";
  }
}
