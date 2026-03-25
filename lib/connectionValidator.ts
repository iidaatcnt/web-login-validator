// connectionValidator.ts — server-side only
// Uses native fetch + Node.js http/https for SSL bypass

import type { ConnectionResult, SiteType } from "./formatValidator";
import * as https from "https";
import * as http from "http";

// ============================================================
// Helpers
// ============================================================

const TIMEOUT_MS = 10_000;

/**
 * Build a fetch-compatible RequestInit with a timeout signal.
 */
function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/**
 * Low-level HTTP(S) request using Node's built-in modules.
 * This is used when we need to bypass SSL verification.
 * Returns { status, headers, body, finalUrl }.
 */
interface RawResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body: string;
  finalUrl: string;
}

function nodeRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    rejectUnauthorized?: boolean;
    followRedirects?: boolean;
    maxRedirects?: number;
  } = {}
): Promise<RawResponse> {
  const {
    method = "GET",
    headers = {},
    body,
    rejectUnauthorized = false,
    followRedirects = true,
    maxRedirects = 5,
  } = options;

  return new Promise((resolve, reject) => {
    let redirectCount = 0;

    const doRequest = (currentUrl: string) => {
      let parsed: URL;
      try {
        parsed = new URL(currentUrl);
      } catch (e) {
        reject(new Error(`無効なURL: ${currentUrl}`));
        return;
      }

      const isHttps = parsed.protocol === "https:";
      const lib = isHttps ? https : http;

      const reqOptions: https.RequestOptions = {
        method,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; LoginValidator/1.0)",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ja,en;q=0.5",
          ...headers,
        },
        rejectUnauthorized,
        timeout: TIMEOUT_MS,
      };

      const req = lib.request(currentUrl, reqOptions, (res) => {
        const status = res.statusCode ?? 0;
        const resHeaders: Record<string, string | string[]> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (v !== undefined) resHeaders[k] = v;
        }

        // Handle redirects
        if (
          followRedirects &&
          [301, 302, 303, 307, 308].includes(status) &&
          res.headers.location
        ) {
          if (redirectCount >= maxRedirects) {
            reject(new Error("リダイレクト上限に達しました"));
            return;
          }
          redirectCount++;
          let nextUrl = res.headers.location;
          // Resolve relative redirects
          try {
            nextUrl = new URL(nextUrl, currentUrl).href;
          } catch {
            // keep as-is
          }
          res.resume(); // drain
          doRequest(nextUrl);
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status,
            headers: resHeaders,
            body: Buffer.concat(chunks).toString("utf8"),
            finalUrl: currentUrl,
          });
        });
        res.on("error", reject);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("接続タイムアウト（10秒）"));
      });
      req.on("error", reject);

      if (body) {
        req.write(body);
      }
      req.end();
    };

    doRequest(url);
  });
}

// ============================================================
// Nonce extraction from WordPress login page HTML
// ============================================================

function extractWpLoginNonce(html: string): string | null {
  // WordPress login page has a hidden input _wpnonce or loginform nonce
  // Patterns: name="_wpnonce" ... value="xxx" or name="testcookie"
  const nonceMatch =
    html.match(/name=["']_wpnonce["'][^>]*value=["']([^"']+)["']/) ||
    html.match(/value=["']([^"']+)["'][^>]*name=["']_wpnonce["']/);
  return nonceMatch ? nonceMatch[1] : null;
}

function extractRedirectTo(html: string): string {
  const match =
    html.match(/name=["']redirect_to["'][^>]*value=["']([^"']+)["']/) ||
    html.match(/value=["']([^"']*)["'][^>]*name=["']redirect_to["']/);
  return match ? match[1] : "wp-admin/";
}

// ============================================================
// WordPress login validator
// ============================================================

async function validateWordPressLogin(
  loginUrl: string,
  userId: string,
  password: string
): Promise<ConnectionResult> {
  // Normalize: ensure URL points to wp-login.php
  let wpLoginUrl: string;
  try {
    const parsed = new URL(loginUrl);
    if (parsed.pathname.includes("wp-login.php")) {
      wpLoginUrl = loginUrl;
    } else if (parsed.pathname.includes("wp-admin")) {
      // wp-admin usually redirects to wp-login.php; construct it directly
      wpLoginUrl =
        parsed.origin +
        parsed.pathname.replace(/\/wp-admin.*$/, "") +
        "/wp-login.php";
    } else {
      wpLoginUrl = loginUrl;
    }
  } catch {
    return {
      reachable: false,
      sslWarning: false,
      loginStatus: "URL_NOT_FOUND",
      detail: "URLのパース中にエラーが発生しました",
    };
  }

  // Step 1: GET the login page
  let getResponse: RawResponse;
  let sslWarning = false;

  try {
    getResponse = await nodeRequest(wpLoginUrl, {
      method: "GET",
      rejectUnauthorized: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      reachable: false,
      sslWarning: false,
      loginStatus: "URL_NOT_FOUND",
      detail: `ログインURLへの接続に失敗しました: ${msg}`,
    };
  }

  // Check for SSL by retrying with strict mode
  try {
    await nodeRequest(wpLoginUrl, {
      method: "GET",
      rejectUnauthorized: true,
    });
  } catch {
    sslWarning = true;
  }

  if (getResponse.status === 404) {
    return {
      reachable: true,
      sslWarning,
      loginStatus: "LOGIN_PAGE_NOT_FOUND",
      detail: "wp-login.phpが見つかりません（404）",
    };
  }

  if (getResponse.status < 200 || (getResponse.status >= 400 && getResponse.status !== 404)) {
    return {
      reachable: true,
      sslWarning,
      loginStatus: "LOGIN_PAGE_NOT_FOUND",
      detail: `ログインページの取得に失敗しました（HTTP ${getResponse.status}）`,
    };
  }

  const loginPageHtml = getResponse.body;

  // Verify it's actually a WordPress login page
  const isWpLogin =
    loginPageHtml.includes("wp-login") ||
    loginPageHtml.includes("user_login") ||
    loginPageHtml.includes("loginform");

  if (!isWpLogin) {
    return {
      reachable: true,
      sslWarning,
      loginStatus: "LOGIN_PAGE_NOT_FOUND",
      detail:
        "WordPressのログインページが確認できませんでした（ページ内容が想定と異なります）",
    };
  }

  // Extract form fields
  const nonce = extractWpLoginNonce(loginPageHtml);
  const redirectTo = extractRedirectTo(loginPageHtml);

  // Extract cookies from GET response
  const setCookieHeader = getResponse.headers["set-cookie"];
  const cookies: string[] = [];
  if (Array.isArray(setCookieHeader)) {
    setCookieHeader.forEach((c) => {
      const cookiePart = c.split(";")[0];
      cookies.push(cookiePart);
    });
  } else if (typeof setCookieHeader === "string") {
    cookies.push(setCookieHeader.split(";")[0]);
  }
  // WordPress needs testcookie
  cookies.push("wordpress_test_cookie=WP+Cookie+check");

  // Step 2: POST credentials
  const formFields: Record<string, string> = {
    log: userId.trim(),
    pwd: password,
    wp_submit: "ログイン",
    redirect_to: redirectTo || "wp-admin/",
    testcookie: "1",
  };
  if (nonce) {
    formFields["_wpnonce"] = nonce;
  }

  const formBody = Object.entries(formFields)
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
    )
    .join("&");

  let postResponse: RawResponse;
  try {
    postResponse = await nodeRequest(wpLoginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookies.join("; "),
        "Referer": wpLoginUrl,
        "Origin": new URL(wpLoginUrl).origin,
      },
      body: formBody,
      rejectUnauthorized: false,
      followRedirects: false, // We want to inspect the redirect
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      reachable: true,
      sslWarning,
      loginStatus: "AUTH_FAILED",
      detail: `ログインリクエスト送信中にエラー: ${msg}`,
    };
  }

  // Check result
  const location =
    (postResponse.headers["location"] as string) || "";
  const responseBody = postResponse.body;

  // Success: redirect to wp-admin
  if (
    postResponse.status >= 300 &&
    postResponse.status < 400 &&
    location.includes("wp-admin")
  ) {
    return {
      reachable: true,
      sslWarning,
      loginStatus: "LOGIN_SUCCESS",
      detail: "WordPressへのログインに成功しました",
    };
  }

  // Check for 2FA / MFA indicators in response body
  if (
    responseBody.includes("two-step") ||
    responseBody.includes("two_step") ||
    responseBody.includes("2fa") ||
    responseBody.includes("otp") ||
    responseBody.includes("verification code") ||
    responseBody.includes("authenticator") ||
    responseBody.includes("二段階")
  ) {
    return {
      reachable: true,
      sslWarning,
      loginStatus: "MFA_REQUIRED",
      detail:
        "多要素認証（2FA）が有効なため、自動ログイン検証をスキップしました",
    };
  }

  // Still on login page with error
  if (
    responseBody.includes("incorrect") ||
    responseBody.includes("invalid") ||
    responseBody.includes("エラー") ||
    responseBody.includes("login_error") ||
    responseBody.includes("shake")
  ) {
    return {
      reachable: true,
      sslWarning,
      loginStatus: "AUTH_FAILED",
      detail:
        "認証に失敗しました。ユーザIDまたはパスワードが正しくありません",
    };
  }

  // Generic failure
  return {
    reachable: true,
    sslWarning,
    loginStatus: "AUTH_FAILED",
    detail: `ログインに失敗しました（HTTP ${postResponse.status}）`,
  };
}

// ============================================================
// Generic site reachability check
// ============================================================

async function checkReachability(url: string): Promise<ConnectionResult> {
  let sslWarning = false;

  try {
    const response = await nodeRequest(url, {
      method: "GET",
      rejectUnauthorized: false,
    });

    // Probe SSL strictness
    try {
      await nodeRequest(url, { method: "GET", rejectUnauthorized: true });
    } catch {
      sslWarning = true;
    }

    const reachable =
      response.status >= 200 && response.status < 500;

    return {
      reachable,
      sslWarning,
      loginStatus: reachable ? "SKIPPED" : "URL_NOT_FOUND",
      detail: reachable
        ? `接続成功（HTTP ${response.status}）${sslWarning ? "。SSL証明書に問題があります" : ""}`
        : `接続に失敗しました（HTTP ${response.status}）`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      reachable: false,
      sslWarning: false,
      loginStatus: "URL_NOT_FOUND",
      detail: `URLへの接続に失敗しました: ${msg}`,
    };
  }
}

// ============================================================
// Main entry point
// ============================================================

export async function validateConnection(
  url: string,
  userId: string,
  password: string,
  siteType: SiteType
): Promise<ConnectionResult> {
  // Disable SSL verification globally for this server action
  // (scoped to this process, with warning surfaced in result)
  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  try {
    switch (siteType) {
      case "WordPress管理画面":
        return await validateWordPressLogin(url, userId, password);

      case "Xserverコントロールパネル":
      case "さくらインターネット コントロールパネル":
      case "不明（汎用サイト）":
      default:
        return await checkReachability(url);
    }
  } finally {
    if (prev === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
    }
  }
}
