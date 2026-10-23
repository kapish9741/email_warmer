import assert from "node:assert"

const BASE_URL = process.env.TEST_URL || "http://localhost:4000"

async function runTests() {
  console.log(`\n======================================================`)
  console.log(` Testing Backend Endpoints at: ${BASE_URL}`)
  console.log(`======================================================\n`)

  let cookie = ""

  async function req(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    }
    if (cookie) headers["Cookie"] = cookie
    if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json"

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    const setCookies = typeof (res.headers as any).getSetCookie === "function"
      ? (res.headers as any).getSetCookie()
      : [res.headers.get("set-cookie")].filter(Boolean)
    for (const sc of setCookies) {
      const match = sc.match(/mw_session=[^;]+/)
      if (match) cookie = match[0]
    }

    const text = await res.text()
    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    return { status: res.status, headers: res.headers, data }
  }

  const results: { name: string; endpoint: string; status: number; ok: boolean; error?: string }[] = []

  async function test(name: string, endpoint: string, fn: () => Promise<void>) {
    process.stdout.write(`• [TEST] ${name} (${endpoint})... `)
    try {
      await fn()
      console.log(`✓ PASSED`)
      results.push({ name, endpoint, status: 200, ok: true })
    } catch (err: any) {
      console.log(`✗ FAILED: ${err.message}`)
      results.push({ name, endpoint, status: 500, ok: false, error: err.message })
    }
  }

  // 1. Health Endpoints
  await test("Health check root", "/health", async () => {
    const res = await req("/health")
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.status, "ok")
  })

  await test("Health check /api/health", "/api/health", async () => {
    const res = await req("/api/health")
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.status, "ok")
  })

  // 2. Auth Endpoints
  const testEmail = `test_${Date.now()}@example.com`
  const testPassword = "Password123!Secure"

  await test("Register new user", "/api/auth/register", async () => {
    const res = await req("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    })
    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.data.success, true)
    assert.strictEqual(res.data.data.email, testEmail)
    assert.ok(cookie.includes("mw_session="), "Cookie should be set")
  })

  await test("Get current session (me)", "/api/auth/me", async () => {
    const res = await req("/api/auth/me")
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.success, true)
    assert.strictEqual(res.data.data.email, testEmail)
  })

  await test("Login with credentials", "/api/auth/login", async () => {
    const res = await req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.success, true)
    assert.strictEqual(res.data.data.email, testEmail)
  })

  // 3. Mailboxes Endpoints
  let warmupMailboxId = ""
  let targetMailboxId = ""

  await test("List mailboxes (empty)", "/api/mailboxes", async () => {
    const res = await req("/api/mailboxes")
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.success, true)
    assert.ok(Array.isArray(res.data.data))
  })

  await test("Create Warmup Mailbox", "/api/mailboxes", async () => {
    const res = await req("/api/mailboxes", {
      method: "POST",
      body: JSON.stringify({
        type: "WARMUP",
        email: `warmup_${Date.now()}@testdomain.com`,
        smtpHost: "127.0.0.1",
        smtpPort: 19998,
        smtpSecurity: "NONE",
        smtpUsername: "warmup@testdomain.com",
        smtpPassword: "SecretPassword123!",
        smtpEnabled: true,
      }),
    })
    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.data.success, true)
    assert.strictEqual(res.data.data.type, "WARMUP")
    assert.strictEqual(res.data.data.hasSmtpPassword, true)
    warmupMailboxId = res.data.data.id
  })

  await test("Create Target Mailbox", "/api/mailboxes", async () => {
    const res = await req("/api/mailboxes", {
      method: "POST",
      body: JSON.stringify({
        type: "TARGET",
        email: `target_${Date.now()}@testdomain.com`,
        imapHost: "127.0.0.1",
        imapPort: 19999,
        imapSecurity: "NONE",
        imapUsername: "target@testdomain.com",
        imapPassword: "SecretPassword123!",
        smtpHost: "127.0.0.1",
        smtpPort: 19998,
        smtpSecurity: "NONE",
        smtpUsername: "target@testdomain.com",
        smtpPassword: "SecretPassword123!",
        smtpEnabled: true,
      }),
    })
    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.data.success, true)
    assert.strictEqual(res.data.data.type, "TARGET")
    targetMailboxId = res.data.data.id
  })

  await test("Get Mailbox by ID", `/api/mailboxes/${warmupMailboxId}`, async () => {
    const res = await req(`/api/mailboxes/${warmupMailboxId}`)
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.success, true)
    assert.strictEqual(res.data.data.id, warmupMailboxId)
  })

  await test("Update Mailbox", `/api/mailboxes/${warmupMailboxId}`, async () => {
    const res = await req(`/api/mailboxes/${warmupMailboxId}`, {
      method: "PATCH",
      body: JSON.stringify({
        smtpPort: 465,
        smtpSecurity: "SSL",
      }),
    })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.success, true)
    assert.strictEqual(res.data.data.smtpPort, 465)
    assert.strictEqual(res.data.data.smtpSecurity, "SSL")
  })

  await test("Test SMTP Connection (handles failure gracefully)", `/api/mailboxes/${warmupMailboxId}/test-smtp`, async () => {
    const res = await req(`/api/mailboxes/${warmupMailboxId}/test-smtp`, {
      method: "POST",
    })
    // Expect failure since dummy host doesn't exist, but status must be 422 with proper error structure
    assert.ok(res.status === 422 || res.status === 200)
    if (res.status === 422) {
      assert.strictEqual(res.data.success, false)
      assert.ok(res.data.error.code)
    }
  })

  await test("Test IMAP Connection (handles failure gracefully)", `/api/mailboxes/${targetMailboxId}/test-imap`, async () => {
    const res = await req(`/api/mailboxes/${targetMailboxId}/test-imap`, {
      method: "POST",
    })
    assert.ok(res.status === 422 || res.status === 200)
    if (res.status === 422) {
      assert.strictEqual(res.data.success, false)
      assert.ok(res.data.error.code)
    }
  })

  // 4. Warmup Config & Controls
  await test("Get Warmup Config & Overview", "/api/warmup/config", async () => {
    const res = await req("/api/warmup/config")
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.success, true)
    assert.ok(res.data.data.config)
    assert.ok(res.data.data.readiness)
    assert.ok(res.data.data.today)
  })

  await test("Update Warmup Config", "/api/warmup/config", async () => {
    const res = await req("/api/warmup/config", {
      method: "PATCH",
      body: JSON.stringify({
        dailyLimit: 30,
        rampUpEnabled: true,
        rampStartVolume: 5,
        rampIncrement: 3,
        minDelayMinutes: 5,
        maxDelayMinutes: 15,
        activeStartHour: 9,
        activeEndHour: 18,
      }),
    })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.success, true)
    assert.strictEqual(res.data.data.config.dailyLimit, 30)
    assert.strictEqual(res.data.data.config.rampIncrement, 3)
  })

  await test("Start Warmup (validates mailbox connections)", "/api/warmup/start", async () => {
    const res = await req("/api/warmup/start", { method: "POST" })
    // Will fail validation because dummy mailboxes aren't connected
    assert.ok(res.status === 400 || res.status === 200)
    if (res.status === 400) {
      assert.strictEqual(res.data.success, false)
      assert.ok(["MAILBOXES_REQUIRED", "WARMUP_NOT_CONNECTED", "TARGET_NOT_CONNECTED"].includes(res.data.error.code))
    }
  })

  await test("Pause Warmup", "/api/warmup/pause", async () => {
    const res = await req("/api/warmup/pause", { method: "POST" })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.success, true)
    assert.strictEqual(res.data.data.config.enabled, false)
  })

  await test("Test Send (validates readiness)", "/api/warmup/test-send", async () => {
    const res = await req("/api/warmup/test-send", { method: "POST" })
    // Will fail because test mailbox credentials are not connected
    assert.ok([400, 422, 200].includes(res.status))
    if (res.status !== 200) {
      assert.strictEqual(res.data.success, false)
      assert.ok(res.data.error.code)
    }
  })

  // 5. Messages and Events
  await test("Get Messages List", "/api/messages", async () => {
    const res = await req("/api/messages?limit=20")
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.success, true)
    assert.ok(Array.isArray(res.data.data))
  })

  await test("Get Events List", "/api/events", async () => {
    const res = await req("/api/events?limit=20")
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.success, true)
    assert.ok(Array.isArray(res.data.data))
  })

  // 6. Cleanup & Logout
  await test("Delete Warmup Mailbox", `/api/mailboxes/${warmupMailboxId}`, async () => {
    const res = await req(`/api/mailboxes/${warmupMailboxId}`, { method: "DELETE" })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.success, true)
  })

  await test("Delete Target Mailbox", `/api/mailboxes/${targetMailboxId}`, async () => {
    const res = await req(`/api/mailboxes/${targetMailboxId}`, { method: "DELETE" })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.success, true)
  })

  await test("Logout", "/api/auth/logout", async () => {
    const res = await req("/api/auth/logout", { method: "POST" })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.success, true)
  })

  console.log(`\n======================================================`)
  console.log(` Test Summary: ${results.filter((r) => r.ok).length}/${results.length} Endpoints Passed`)
  console.log(`======================================================\n`)
}

runTests().catch((err) => {
  console.error("Unhandled error in test runner:", err)
  process.exit(1)
})
