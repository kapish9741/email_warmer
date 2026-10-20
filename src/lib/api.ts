import type {
  Mailbox,
  MailboxInput,
  MessageStatus,
  MessageType,
  User,
  WarmupConfigInput,
  WarmupEvent,
  WarmupMessage,
  WarmupOverview,
} from "@/lib/types"

// Requests go to this origin and are proxied to the backend (see next.config.ts).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ""

export interface ApiError {
  code: string
  message: string
  details?: { fields?: { path: string; message: string }[] }
}

export type ApiResponse<T> = { success: true; data: T } | { success: false; error: ApiError }

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    })

    const body = (await res.json().catch(() => null)) as ApiResponse<T> | null
    if (res.status === 401 && typeof window !== "undefined" && !endpoint.startsWith("/api/auth/")) {
      // Session expired: a full navigation clears all client state before showing the login page.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login"
    }
    if (!body) {
      return { success: false, error: { code: "BAD_RESPONSE", message: `Unexpected server response (${res.status})` } }
    }
    return body
  } catch {
    return {
      success: false,
      error: { code: "NETWORK_ERROR", message: "Could not reach the server. Check that the backend is running" },
    }
  }
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
})

function query(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ""
}

export interface MessageFilters {
  status?: MessageStatus
  type?: MessageType
  from?: string
  to?: string
  q?: string
  limit?: number
}

export const api = {
  // Auth
  me: () => request<User>("/api/auth/me"),
  login: (email: string, password: string) => request<User>("/api/auth/login", json("POST", { email, password })),
  register: (email: string, password: string) => request<User>("/api/auth/register", json("POST", { email, password })),
  logout: () => request<object>("/api/auth/logout", json("POST")),

  // Mailboxes
  getMailboxes: () => request<Mailbox[]>("/api/mailboxes"),
  getMailbox: (id: string) => request<Mailbox>(`/api/mailboxes/${id}`),
  createMailbox: (data: MailboxInput) => request<Mailbox>("/api/mailboxes", json("POST", data)),
  updateMailbox: (id: string, data: MailboxInput) => request<Mailbox>(`/api/mailboxes/${id}`, json("PATCH", data)),
  deleteMailbox: (id: string) => request<object>(`/api/mailboxes/${id}`, json("DELETE")),
  testSmtp: (id: string) => request<{ message: string; testedAt: string; mailbox: Mailbox }>(`/api/mailboxes/${id}/test-smtp`, json("POST")),
  testImap: (id: string) => request<{ message: string; testedAt: string; mailbox: Mailbox }>(`/api/mailboxes/${id}/test-imap`, json("POST")),

  // Warmup
  getWarmupConfig: () => request<WarmupOverview>("/api/warmup/config"),
  updateWarmupConfig: (data: WarmupConfigInput) => request<WarmupOverview>("/api/warmup/config", json("PATCH", data)),
  startWarmup: () => request<WarmupOverview>("/api/warmup/start", json("POST")),
  pauseWarmup: () => request<WarmupOverview>("/api/warmup/pause", json("POST")),
  testSend: () => request<WarmupMessage>("/api/warmup/test-send", json("POST")),

  // Activity & Events
  getMessages: (filters: MessageFilters = {}) => request<WarmupMessage[]>(`/api/messages${query({ ...filters })}`),
  getMessage: (id: string) => request<WarmupMessage & { events: WarmupEvent[] }>(`/api/messages/${id}`),
  getEvents: (params: { limit?: number; since?: string; type?: string } = {}) =>
    request<WarmupEvent[]>(`/api/events${query(params)}`),
}
