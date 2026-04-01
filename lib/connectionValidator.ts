// connectionValidator.ts — server-side only
// Uses native fetch + Node.js http/https for SSL bypass

import type { ConnectionResult, SiteType } from "./formatValidator";
import * as https from "https";
import * as http from "http";

// ============================================================
// Helpers
// ============================================================

const TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

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
      headers: customHeaders = {},
      body,
      rejectUnauthorized = false,
      followRedirects = true,
      maxRedirects = 5,
    } = options;

    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      "Cache-Control": "max-age=0",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-User": "?1",
      "Sec-Fetch-Dest": "document",
      ...customHeaders,
    };

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
  // Use the provided URL directly first. 
  // We trust that the client might be providing a custom login URL.
  let wpLoginUrl = loginUrl;
  
  // Basic validation of URL structure
  try {
    new URL(loginUrl);
  } catch {
    return {
      reachable: false,
      sslWarning: false,
      loginStatus: "URL_NOT_FOUND",
      detail: "URLの形式が正しくありません",
    };
  }

  // Step 0: Establish session by visiting the site root first (WAF Bypass)
  let cookies: string[] = [];
  // Correctly identify the "Base URL" of the site up to the last slash
  let siteBaseUrl: string;
  try {
     const parsed = new URL(wpLoginUrl);
     const lastSlashIdx = parsed.href.lastIndexOf('/');
     siteBaseUrl = parsed.href.substring(0, lastSlashIdx + 1);
  } catch {
     siteBaseUrl = wpLoginUrl; // Fallback
  }

  try {
     const homeResponse = await nodeRequest(siteBaseUrl, {
       method: "GET",
       headers: { "User-Agent": USER_AGENT },
       rejectUnauthorized: false,
     });
     // Extract initial cookies
     const homeCookies = homeResponse.headers["set-cookie"];
     if (Array.isArray(homeCookies)) {
       homeCookies.forEach(c => cookies.push(c.split(";")[0]));
     } else if (typeof homeCookies === "string") {
       cookies.push(homeCookies.split(";")[0]);
     }
  } catch {
     // Ignore Home Page errors, we'll try login page anyway
  }

  // HUMAN WAIT: Sleep for 1.2 seconds to mimic human interaction
  await new Promise(resolve => setTimeout(resolve, 1200));

  // Step 1: Fetch the login page with cookies and Referer
  let getResponse: RawResponse;
  let sslWarning = false;

  try {
    getResponse = await nodeRequest(wpLoginUrl, {
      method: "GET",
      headers: { 
        "User-Agent": USER_AGENT,
        "Cookie": cookies.join("; "),
        "Referer": siteBaseUrl,
      },
      rejectUnauthorized: false, // Accept self-signed certs
    });

    // Redirect handling: if we were redirected, update our login URL
    if (getResponse.headers["location"]) {
      wpLoginUrl = new URL(getResponse.headers["location"] as string, wpLoginUrl).href;
    }

    let loginPageHtml = getResponse.body;

    // AUTO-DISCOVERY: If this doesn't look like a login page, try appending /wp-admin/
    if (!loginPageHtml.includes("user_login") && !loginPageHtml.includes("pwd")) {
      const fallbackUrl = wpLoginUrl.endsWith("/") ? wpLoginUrl + "wp-admin/" : wpLoginUrl + "/wp-admin/";
      try {
        const fallbackResponse = await nodeRequest(fallbackUrl, {
          method: "GET",
          headers: { "User-Agent": USER_AGENT },
          rejectUnauthorized: false,
        });
        // If the fallback (wp-admin) looks more like a login page, use it
        if (fallbackResponse.body.includes("user_login") || fallbackResponse.body.includes("pwd")) {
          wpLoginUrl = fallbackUrl;
          loginPageHtml = fallbackResponse.body;
          getResponse = fallbackResponse;
        }
      } catch {
         // Ignore fallback errors, we'll proceed with original or fail later
      }
    }
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
  // We check for "wp-login", various form fields, or standard WP strings
  const isWpLogin =
    loginPageHtml.includes("wp-login") ||
    loginPageHtml.includes("user_login") ||
    loginPageHtml.includes("loginform") ||
    loginPageHtml.includes("wp-content") ||
    loginPageHtml.includes("WordPress");

  if (!isWpLogin) {
    // If not obviously WP, we still try if the URL was explicitly provided as a custom login
    // but we show a warning if it doesn't look like a login form.
    if (!loginPageHtml.includes("password") && !loginPageHtml.includes("pwd")) {
       return {
         reachable: true,
         sslWarning,
         loginStatus: "LOGIN_PAGE_NOT_FOUND",
         detail: "指定されたURLにログインフォームが見つかりませんでした。URLが正しいか確認してください",
       };
    }
  }

  // Extract form fields
  const nonce = extractWpLoginNonce(loginPageHtml);
  const redirectTo = extractRedirectTo(loginPageHtml);

  // Extract cookies from GET response
  const setCookieHeader = getResponse.headers["set-cookie"];
  if (Array.isArray(setCookieHeader)) {
    setCookieHeader.forEach((c) => {
      const cookiePart = c.split(";")[0];
      if (!cookies.includes(cookiePart)) {
        cookies.push(cookiePart);
      }
    });
  } else if (typeof setCookieHeader === "string") {
    const cookiePart = setCookieHeader.split(";")[0];
    if (!cookies.includes(cookiePart)) {
      cookies.push(cookiePart);
    }
  }
  // WordPress needs testcookie
  if (!cookies.some(c => c.startsWith("wordpress_test_cookie="))) {
    cookies.push("wordpress_test_cookie=WP%20Cookie%20check");
  }

  // Step 2: POST credentials
  const formFields: Record<string, string> = {
    log: userId.trim(),
    pwd: password,
    "wp-submit": "ログイン",
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
  const resCookies = postResponse.headers["set-cookie"];
  const isRedirectToAdmin = location.includes("wp-admin");
  const hasLoggedInCookie = (Array.isArray(resCookies) ? resCookies.join(" ") : (resCookies || "")).includes("wordpress_logged_in");

  // Success Indicators: 
  // 1. Redirect to wp-admin
  // 2. Issuance of wordpress_logged_in cookie
  if ((postResponse.status >= 300 && postResponse.status < 400 && isRedirectToAdmin) || hasLoggedInCookie) {
    // Step 4: Verify Administrator Privileges (Follow-up check)
    try {
      const adminUrl = new URL(wpLoginUrl).origin + "/wp-admin/";
      const dashboardResponse = await nodeRequest(adminUrl, {
        method: "GET",
        headers: {
          "Cookie": [...cookies, ...extractResCookies(resCookies)].join("; "),
          "Referer": wpLoginUrl,
        },
        rejectUnauthorized: false,
      });

      const dashboardHtml = dashboardResponse.body;
      // Administrator check: Look for "Plugins" or "Settings" menus which are admin-only
      const isAdmin =
        dashboardHtml.includes("id=\"menu-plugins\"") ||
        dashboardHtml.includes("id=\"menu-settings\"") ||
        dashboardHtml.includes("id=\"menu-users\"") ||
        dashboardHtml.includes("id=\"menu-appearance\"");

      if (isAdmin) {
        return {
          reachable: true,
          sslWarning,
          loginStatus: "LOGIN_SUCCESS",
          detail: "WordPressへのログインに成功しました（管理者権限を確認済み）",
        };
      } else {
        return {
          reachable: true,
          sslWarning,
          loginStatus: "AUTH_FAILED",
          detail: "ログインには成功しましたが、管理者権限がありません。情報の昇格をご依頼ください",
        };
      }
    } catch {
      // If privilege check fails but login worked, return basic success
      return {
        reachable: true,
        sslWarning,
        loginStatus: "LOGIN_SUCCESS",
        detail: "WordPressへのログインに成功しました（権限確認はスキップされました）",
      };
    }
  }

  // Helper inside validateWordPressLogin to extract cookies from POST
  function extractResCookies(header: string | string[] | undefined): string[] {
    const list: string[] = [];
    if (Array.isArray(header)) {
      header.forEach(c => list.push(c.split(";")[0]));
    } else if (typeof header === "string") {
      list.push(header.split(";")[0]);
    }
    return list;
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
