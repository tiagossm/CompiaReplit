import { QueryClient, QueryFunction } from "@tanstack/react-query";

function appendSearchParam(
  params: URLSearchParams,
  key: string,
  value: unknown,
) {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => appendSearchParam(params, key, item));
    return;
  }

  if (value instanceof Date) {
    params.append(key, value.toISOString());
    return;
  }

  if (value && typeof value === "object") {
    params.append(key, JSON.stringify(value));
    return;
  }

  params.append(key, String(value));
}

function normalisePath(base: string, segment: string): string {
  if (!base) {
    return segment;
  }

  if (!segment) {
    return base;
  }

  if (base.endsWith("/")) {
    return segment.startsWith("/") ? `${base}${segment.slice(1)}` : `${base}${segment}`;
  }

  return segment.startsWith("/") ? `${base}${segment}` : `${base}/${segment}`;
}

function buildUrlFromQueryKey(queryKey: readonly unknown[]): string {
  if (!queryKey.length) {
    throw new Error("Query key must not be empty");
  }

  const searchParams = new URLSearchParams();
  const pathSegments: string[] = [];

  queryKey.forEach((segment, index) => {
    if (segment === undefined || segment === null) {
      return;
    }

    if (typeof segment === "string") {
      const queryStart = segment.indexOf("?");
      const hasQuery = queryStart !== -1;
      const pathPart = hasQuery ? segment.slice(0, queryStart) : segment;
      const queryString = hasQuery ? segment.slice(queryStart + 1) : "";

      if (pathPart) {
        pathSegments.push(pathPart);
      } else if (index === 0 && pathSegments.length === 0) {
        pathSegments.push("");
      }

      if (queryString) {
        const params = new URLSearchParams(queryString);
        params.forEach((value, key) => {
          searchParams.append(key, value);
        });
      }
      return;
    }

    if (typeof segment === "number" || typeof segment === "boolean") {
      pathSegments.push(String(segment));
      return;
    }

    if (segment instanceof URLSearchParams) {
      segment.forEach((value, key) => {
        searchParams.append(key, value);
      });
      return;
    }

    if (Array.isArray(segment)) {
      segment.forEach((value) => {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          pathSegments.push(String(value));
        } else if (value instanceof URLSearchParams) {
          value.forEach((v, key) => {
            searchParams.append(key, v);
          });
        } else if (value && typeof value === "object") {
          Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
            appendSearchParam(searchParams, key, val);
          });
        }
      });
      return;
    }

    if (typeof segment === "object") {
      Object.entries(segment as Record<string, unknown>).forEach(([key, value]) => {
        appendSearchParam(searchParams, key, value);
      });
      return;
    }

    pathSegments.push(String(segment));
  });

  const path = pathSegments.reduce((acc, segment, idx) => {
    if (idx === 0) {
      return segment;
    }
    return normalisePath(acc, segment);
  }, "");

  const queryString = searchParams.toString();

  if (!queryString) {
    return path;
  }

  return path.includes("?") ? `${path}&${queryString}` : `${path}?${queryString}`;
}

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
    // if caller passed body as plain object in third arg, prefer it
    if (data !== undefined) {
      options.headers = { ...(options.headers || {}), "Content-Type": "application/json" };
      options.body = JSON.stringify(data);
    }
  }

  const res = await fetch(url, options);
  await throwIfResNotOk(res);

  // attempt to parse JSON, but return text if parsing fails
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

type UnauthorizedBehavior = "returnNull" | "throw";
// Keep the query function flexible and return any so callers can type their queries
export const getQueryFn: (options: { on401: UnauthorizedBehavior }) => QueryFunction<any> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = buildUrlFromQueryKey(queryKey);
    const res = await fetch(url, {
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
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
