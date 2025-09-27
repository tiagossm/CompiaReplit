import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// apiRequest supports two calling styles used across the codebase:
// 1) apiRequest(url, method, data)
// 2) apiRequest(url, fetchOptions)
export async function apiRequest(
  url: string,
  methodOrOptions?: string | RequestInit,
  data?: unknown,
): Promise<any> {
  let options: RequestInit = { credentials: "include" };

  if (typeof methodOrOptions === "string") {
    options.method = methodOrOptions;
    if (data !== undefined) {
      options.headers = { ...(options.headers || {}), "Content-Type": "application/json" };
      options.body = JSON.stringify(data);
    }
  } else if (methodOrOptions) {
    options = { ...options, ...(methodOrOptions as RequestInit) };
    if (data !== undefined) {
      options.headers = { ...(options.headers || {}), "Content-Type": "application/json" };
      options.body = JSON.stringify(data);
    }
  }

  const res = await fetch(url, options);
  await throwIfResNotOk(res);

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

type UnauthorizedBehavior = "returnNull" | "throw";

// Função para montar a URL a partir do queryKey
function buildRequestUrl(queryKey: unknown): string {
  if (typeof queryKey === "string") {
    return queryKey;
  }

  if (Array.isArray(queryKey)) {
    const parts = queryKey.filter((p) => p !== null && p !== undefined);

    const pathSegments: string[] = [];
    const paramObjects: Array<Record<string, unknown>> = [];

    for (const part of parts) {
      if (typeof part === "string" || typeof part === "number") {
        pathSegments.push(String(part));
      } else if (typeof part === "object" && !Array.isArray(part)) {
        paramObjects.push(part as Record<string, unknown>);
      }
    }

    // monta o path
    let url = pathSegments
      .map((s, i) => (i === 0 && /^https?:\/\//.test(s) ? s : encodeURIComponent(s)))
      .join("/");

    if (!url.startsWith("http") && !url.startsWith("/")) {
      url = "/" + url;
    }

    // monta query string
    const searchParams = new URLSearchParams();
    for (const params of paramObjects) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;

        if (Array.isArray(value)) {
          value.forEach((item) => {
            if (item !== undefined && item !== null) {
              searchParams.append(key, String(item));
            }
          });
        } else if (typeof value === "object") {
          searchParams.append(key, JSON.stringify(value));
        } else {
          searchParams.append(key, String(value));
        }
      }
    }

    const queryString = searchParams.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  return String(queryKey ?? "");
}

// Keep the query function flexible and return any so callers can type their queries
export const getQueryFn: (options: { on401: UnauthorizedBehavior }) => QueryFunction<any> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const requestUrl = buildRequestUrl(queryKey);

    const res = await fetch(requestUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: fa