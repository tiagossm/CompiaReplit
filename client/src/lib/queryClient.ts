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
    const pathSegments: string[] = [];
    const searchParams = new URLSearchParams();

    const toSearchParamValue = (value: unknown) =>
      value instanceof Date ? value.toISOString() : String(value);

    for (const part of queryKey) {
      if (part === undefined || part === null) {
        continue;
      }

      if (part instanceof URLSearchParams) {
        part.forEach((value, key) => {
          searchParams.append(key, value);
        });
        continue;
      }

      if (part instanceof Date) {
        pathSegments.push(part.toISOString());
        continue;
      }

      if (Array.isArray(part)) {
        for (const item of part) {
          if (item === undefined || item === null) {
            continue;
          }
          pathSegments.push(String(item));
        }
        continue;
      }

      if (typeof part === "object") {
        for (const [key, value] of Object.entries(part as Record<string, unknown>)) {
          if (value === undefined || value === null) {
            continue;
          }

          if (Array.isArray(value)) {
            for (const item of value) {
              if (item === undefined || item === null) {
                continue;
              }
              searchParams.append(key, toSearchParamValue(item));
            }
          } else {
            searchParams.append(key, toSearchParamValue(value));
          }
        }
        continue;
      }

      if (typeof part === "string" || typeof part === "number" || typeof part === "boolean") {
        pathSegments.push(String(part));
        continue;
      }

      pathSegments.push(String(part));
    }

    let url = pathSegments[0] ?? "";
    const remainingSegments = pathSegments.slice(1);

    if (remainingSegments.length > 0) {
      const separator = url.endsWith("/") || url === "" ? "" : "/";
      const encodedSegments = remainingSegments.map((segment) => encodeURIComponent(segment));
      url += `${separator}${encodedSegments.join("/")}`;
    }

    const queryString = searchParams.toString();
    if (queryString) {
      url += url.includes("?") ? `&${queryString}` : `?${queryString}`;
    }

    const res = await fetch(url as string, {
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
