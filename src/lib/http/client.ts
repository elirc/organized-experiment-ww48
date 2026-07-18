/**
 * This file wraps browser-side fetch calls so hooks get consistent error handling.
 * What calls it: React Query hooks in src/hooks/**.
 * What it calls: the browser fetch API.
 * A junior engineer would likely get this wrong by duplicating ad hoc response
 * parsing across hooks and accidentally ignoring non-2xx error payloads.
 */
export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(errorPayload?.error ?? "Request failed.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

