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
    const [baseUrl, rawParams] = queryKey as [string, unknown?];

    let requestUrl = baseUrl;

    if (rawParams !== undefined && rawParams !== null) {
      const stableParamsString = JSON.stringify(rawParams);
      const parsedParams = JSON.parse(stableParamsString) as unknown;

      if (
        parsedParams &&
        typeof parsedParams === "object" &&
        !Array.isArray(parsedParams)
      ) {
        const searchParams = new URLSearchParams();

        const appendParam = (key: string, value: unknown) => {
          if (value === undefined || value === null) {
            return;
          }

          if (Array.isArray(value)) {
            value.forEach((item) => appendParam(key, item));
            return;
          }

          if (typeof value === "object") {
            searchParams.append(key, JSON.stringify(value));
            return;
          }

          searchParams.append(key, String(value));
        };

        Object.entries(parsedParams as Record<string, unknown>).forEach(
          ([key, value]) => {
            appendParam(key, value);
          },
        );

        const queryString = searchParams.toString();
        if (queryString) {
          requestUrl = `${baseUrl}?${queryString}`;
        }
      } else {
        const pathSegment = String(parsedParams);
        if (pathSegment) {
          requestUrl = `${baseUrl}/${encodeURIComponent(pathSegment)}`;
        }
      }
    }

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
