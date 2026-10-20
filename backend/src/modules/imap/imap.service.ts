import { ImapFlow, type SearchObject } from "imapflow"
import type { FoundMessage, ImapConfig, MessageSearchCriteria } from "./imap.types"

export type { ImapConfig, FoundMessage, MessageSearchCriteria } from "./imap.types"

export class ImapService {
  public static createClient(config: ImapConfig) {
    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.security === "SSL",
      doSTARTTLS: config.security === "STARTTLS" ? true : config.security === "NONE" ? false : undefined,
      auth: { user: config.username, pass: config.password },
      tls: { rejectUnauthorized: true },
      logger: false,
      connectionTimeout: 20_000,
      greetingTimeout: 15_000,
      socketTimeout: 60_000,
    })
    // ImapFlow emits socket errors as events; without a listener they would crash the process.
    client.on("error", () => {})
    return client
  }

  private static async withClient<T>(config: ImapConfig, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = this.createClient(config)
    await client.connect()
    try {
      return await fn(client)
    } finally {
      await client.logout().catch(() => client.close())
    }
  }

  public static async verifyConnection(config: ImapConfig): Promise<void> {
    await this.withClient(config, async (client) => {
      const lock = await client.getMailboxLock("INBOX", { readOnly: true })
      lock.release()
    })
  }

  /**
   * Searches the real target mailbox for a sent test message: INBOX first, then the Junk/Spam folder.
   * Identifiers are tried from most to least specific; subject matching is always combined with sender and date.
   */
  public static async findMessage(config: ImapConfig, criteria: MessageSearchCriteria): Promise<FoundMessage | null> {
    return this.withClient(config, async (client) => {
      const folders = await client.list()
      const junk = folders.filter((f) => f.specialUse === "\\Junk").map((f) => f.path)
      const candidates: { path: string; placement: FoundMessage["placement"] }[] = [
        { path: "INBOX", placement: "INBOX" },
        ...junk.map((path) => ({ path, placement: "SPAM" as const })),
      ]

      // Some servers only index Message-ID without angle brackets.
      const bareMessageId = criteria.messageId.replace(/^<|>$/g, "")
      const since = new Date(criteria.since.getTime() - 24 * 60 * 60 * 1000)
      const queries: { matchedBy: FoundMessage["matchedBy"]; query: SearchObject }[] = [
        { matchedBy: "message-id", query: { header: { "message-id": bareMessageId } } },
        { matchedBy: "test-id", query: { header: { "x-warmup-test-id": criteria.testId } } },
        { matchedBy: "subject", query: { subject: criteria.testId, from: criteria.from, since } },
        // Templated subjects don't contain the test ID; the body footer always does.
        { matchedBy: "body", query: { body: criteria.testId, from: criteria.from, since } },
      ]

      for (const { path, placement } of candidates) {
        const lock = await client.getMailboxLock(path, { readOnly: true }).catch(() => null)
        if (!lock) continue
        try {
          for (const { matchedBy, query } of queries) {
            const uids = await client.search(query, { uid: true }).catch(() => false as const)
            if (uids && uids.length > 0) {
              return { folder: path, placement, uid: uids[uids.length - 1], matchedBy }
            }
          }
        } finally {
          lock.release()
        }
      }
      return null
    })
  }

  /** Downloads the raw RFC822 source of a message that was actually observed in the mailbox. */
  public static async getMessageSource(config: ImapConfig, folder: string, uid: number): Promise<Buffer | null> {
    return this.withClient(config, async (client) => {
      const lock = await client.getMailboxLock(folder, { readOnly: true })
      try {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true })
        return msg && msg.source ? msg.source : null
      } finally {
        lock.release()
      }
    })
  }
}
