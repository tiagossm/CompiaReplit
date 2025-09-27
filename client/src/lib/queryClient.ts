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
    const parts = queryKey as ReadonlyArray<unknown>;

    const pathSegments: string[] = [];
    const paramObjects: Array<Record<string, unknown>> = [];

    for (const part of parts) {
      if (part === null || part === undefined) {
        continue;
      }

      if (typeof part === "string" || typeof part === "number") {
        const segment = String(part);
        if (segment) {
          pathSegments.push(segment);
        }
        continue;
      }

      if (!Array.isArray(part) && typeof part === "object") {
        paramObjects.push(part as Record<string, unknown>);
      }
    }

    let url = "";

    pathSegments.forEach((segment, index) => {
      if (index === 0) {
        url = segment;
        return;
      }

      const normalizedSegment = segment.replace(/^\/+/, "");
      if (url.endsWith("/")) {
        url = `${url}${normalizedSegment}`;
      } else {
        url = `${url}/${normalizedSegment}`;
      }
    });

    const searchParams = new URLSearchParams();

    for (const params of paramObjects) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;

        if (Array.isArray(value)) {
          for (const item of value) {
            if (item === undefined) continue;
            searchParams.append(key, String(item));
          }
        } else {
          searchParams.append(key, String(value));
        }
      }
    }

    const queryString = searchParams.toString();
    const requestUrl = queryString ? `${url}?${queryString}` : url;

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
