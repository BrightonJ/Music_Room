import { getServerUrl } from './config';
import { storage } from './storage';
import { APP_VERSION, PLATFORM, getDeviceId, getDeviceLabel } from './device';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
};

let unauthorizedHandler: (() => void) | null = null;
let handlingUnauthorized = false;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

// The session is over (expired, logged out elsewhere, device removed): back to login
export async function triggerUnauthorized() {
  if (handlingUnauthorized) return;
  handlingUnauthorized = true;
  try {
    await storage.clearSession();
    unauthorizedHandler?.();
  } finally {
    setTimeout(() => {
      handlingUnauthorized = false;
    }, 1000);
  }
}

// Sent on every request: the backend logs platform, device and app version
export async function clientHeaders(): Promise<Record<string, string>> {
  return {
    'X-Device-Id': await getDeviceId(),
    'X-Platform': PLATFORM,
    'X-Device': getDeviceLabel(),
    'X-App-Version': APP_VERSION,
  };
}

export async function apiFetch<T = any>(path: string, options: Options = {}): Promise<T> {
  const { method = 'GET', body, auth = true, timeoutMs = 10000 } = options;
  const [baseUrl, headers] = await Promise.all([getServerUrl(), clientHeaders()]);
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await storage.getToken();
    if (!token) {
      triggerUnauthorized();
      throw new ApiError('Please log in again.', 401);
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      controller.signal.aborted
        ? 'The server took too long to answer.'
        : `Cannot reach the server at ${baseUrl}. Check the address in Server settings.`,
      0
    );
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.status === 401 && auth) triggerUnauthorized();
  if (!response.ok) {
    throw new ApiError(data?.error || `Request failed (${response.status})`, response.status, data?.code);
  }
  return data as T;
}

export const errorMessage = (err: unknown, fallback = 'Something went wrong') =>
  err instanceof Error && err.message ? err.message : fallback;
