// Warmup email content. Every message is ordinary correspondence between the two mailboxes the user connected:
// it only states things that are true about those mailboxes or general facts, and invents no people, events or deals.
//
// Placeholders (see TEMPLATE_VARIABLES in ./index.ts): {{sender_name}}, {{recipient_name}}, {{sender_first_name}},
// {{recipient_first_name}}, {{sender_email}}, {{recipient_email}}, {{sender_domain}}, {{recipient_domain}}, {{weekday}}, {{date}}, {{time_of_day}},
// {{timezone}}, {{active_window}}, {{daily_limit}}, {{test_id}} and, in replies only, {{original_subject}}.

export type TemplateCategory = "casual" | "professional" | "informational" | "technical"
export type ReplyKind = "answer" | "confirmation" | "acknowledgement" | "conclusion"

export interface EmailTemplate {
  id: string
  category: TemplateCategory
  /** Short description of what the message is for. */
  purpose: string
  subject: string
  body: string
}

export interface ReplyTemplate {
  id: string
  /** The starter template this reply answers. */
  replyTo: string
  kind: ReplyKind
  body: string
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  // ─── Casual correspondence ────────────────────────────────────────────────
  {
    id: "casual-greeting",
    category: "casual",
    purpose: "Greeting",
    subject: "Hello from {{sender_domain}}",
    body: `Hi {{recipient_first_name}},

Just saying hello from {{sender_email}} this {{time_of_day}}. Nothing needs doing on your side.

{{sender_name}}`,
  },
  {
    id: "casual-subject-question",
    category: "casual",
    purpose: "Simple question",
    subject: "Does this subject line fit on your screen?",
    body: `Hi {{recipient_first_name}},

A small question: when this arrives, does the full subject line show in your message list, or does it get cut off?

Thanks,
{{sender_name}}`,
  },
  {
    id: "casual-thanks",
    category: "casual",
    purpose: "Thank-you",
    subject: "Thanks for keeping this inbox connected",
    body: `{{recipient_first_name}},

Thank you for leaving {{recipient_email}} connected. Every message that arrives there adds to this mailbox's sending history.

Appreciated,
{{sender_name}}`,
  },
  {
    id: "casual-weekday-update",
    category: "casual",
    purpose: "Short update",
    subject: "A short {{weekday}} note",
    body: `Hi {{recipient_first_name}},

Short update for {{weekday}}: messages from this address go out between {{active_window}} ({{timezone}}), with at most {{daily_limit}} on any day.

{{sender_name}}`,
  },
  {
    id: "casual-acknowledgement",
    category: "casual",
    purpose: "Acknowledgement",
    subject: "Noted on my side",
    body: `Hi {{recipient_first_name}},

Consider this an acknowledgement from {{sender_email}}: the connection between our two mailboxes is still in place, and I'll keep messages short.

Best,
{{sender_name}}`,
  },
  {
    id: "casual-display-check",
    category: "casual",
    purpose: "Simple question",
    subject: "How does my name appear?",
    body: `Hello {{recipient_first_name}},

Quick one: in your inbox, does this message show a sender name, or only the address {{sender_email}}?

{{sender_name}}`,
  },
  {
    id: "casual-time-of-day",
    category: "casual",
    purpose: "Greeting",
    subject: "Good {{time_of_day}}",
    body: `Good {{time_of_day}}, {{recipient_first_name}}.

This one is simply a hello sent on {{date}}. If it reaches you, the mailbox did its job.

Regards,
{{sender_name}}`,
  },
  {
    id: "casual-reading-preference",
    category: "casual",
    purpose: "Simple question",
    subject: "Short or long messages?",
    body: `Hi {{recipient_first_name}},

Do you find short notes like this easier to skim, or would a slightly longer message read better in your mail client? I'm curious which feels more natural.

{{sender_name}}`,
  },
  {
    id: "casual-check-in",
    category: "casual",
    purpose: "Short update",
    subject: "Checking in from {{sender_email}}",
    body: `{{recipient_first_name}},

Checking in. This mailbox is active today, and I'll keep to the usual schedule.

Talk soon,
{{sender_name}}`,
  },

  // ─── Professional correspondence ──────────────────────────────────────────
  {
    id: "pro-schedule-summary",
    category: "professional",
    purpose: "Project update",
    subject: "Sending schedule for {{weekday}}",
    body: `Hello {{recipient_first_name}},

Here is today's plan for messages from {{sender_email}}:

- Active hours: {{active_window}} ({{timezone}})
- Daily maximum: {{daily_limit}} messages
- Each message is checked for arrival in your Inbox or Junk folder

No action is needed from you. I'm sending this so the schedule is written down somewhere.

Kind regards,
{{sender_name}}`,
  },
  {
    id: "pro-review-time",
    category: "professional",
    purpose: "Meeting coordination",
    subject: "Time to review delivery results",
    body: `Hi {{recipient_first_name}},

Would it be useful to set aside a few minutes to review the delivery results for these two mailboxes? Any time within {{active_window}} ({{timezone}}) works from this side.

If a review isn't needed yet, that's fine too.

Thanks,
{{sender_name}}`,
  },
  {
    id: "pro-folder-clarification",
    category: "professional",
    purpose: "Request for clarification",
    subject: "Question about your folder setup",
    body: `Hello {{recipient_first_name}},

Could you confirm one detail for me? Messages to {{recipient_email}} are looked for in the Inbox first and then in the folder your provider marks as Junk.

If your account files mail into other folders through rules or filters, those messages won't be found, so it would help to know whether any such rules exist.

Thank you,
{{sender_name}}`,
  },
  {
    id: "pro-follow-up",
    category: "professional",
    purpose: "Follow-up",
    subject: "Following up on today's messages",
    body: `Hi {{recipient_first_name}},

A brief follow-up: earlier messages from {{sender_email}} today went out within the {{active_window}} window. I'd like to keep the pace steady rather than send anything in a burst.

If you notice anything unusual about how these arrive, please let me know.

Best regards,
{{sender_name}}`,
  },
  {
    id: "pro-share-details",
    category: "professional",
    purpose: "Sharing information",
    subject: "Connection details for reference",
    body: `Hello {{recipient_first_name}},

For reference, these are the non-sensitive details of this exchange:

From: {{sender_email}}
To: {{recipient_email}}
Time zone: {{timezone}}
Sending window: {{active_window}}

Passwords are never included in these messages.

Regards,
{{sender_name}}`,
  },
  {
    id: "pro-week-check",
    category: "professional",
    purpose: "Project update",
    subject: "Status note, {{date}}",
    body: `{{recipient_first_name}},

A status note for {{date}}: this mailbox is sending on its regular schedule, with no more than {{daily_limit}} messages per day. Delivery is confirmed only when a message is actually found in your mailbox.

I'll send another note if anything about the schedule changes.

{{sender_name}}`,
  },
  {
    id: "pro-reply-request",
    category: "professional",
    purpose: "Request for clarification",
    subject: "Are replies reaching {{sender_domain}}?",
    body: `Hi {{recipient_first_name}},

When you reply to one of these messages, the reply should come back to {{sender_email}} in the same thread.

Could you reply to this one so we can see that it threads correctly on both sides?

Thanks in advance,
{{sender_name}}`,
  },
  {
    id: "pro-schedule-change",
    category: "professional",
    purpose: "Meeting coordination",
    subject: "Proposed sending window",
    body: `Hello {{recipient_first_name}},

The current sending window is {{active_window}} in {{timezone}}. If a different window would suit the way you check {{recipient_email}}, it can be changed in the warmup settings at any time.

Let me know if you'd like to keep it as it is.

Regards,
{{sender_name}}`,
  },
  {
    id: "pro-thanks-and-next",
    category: "professional",
    purpose: "Follow-up",
    subject: "Thank you, and what comes next",
    body: `Hi {{recipient_first_name}},

Thank you for keeping the target mailbox available. Over the coming days the number of messages will rise gradually toward {{daily_limit}} per day, never above that limit.

Best,
{{sender_name}}`,
  },

  // ─── Informational emails ─────────────────────────────────────────────────
  {
    id: "info-message-id",
    category: "informational",
    purpose: "Sharing useful information",
    subject: "What a Message-ID is for",
    body: `Hi {{recipient_first_name}},

Something worth knowing: every email carries a Message-ID header, a unique identifier assigned when the message is created. Mail clients use it to recognize duplicates, and replies reference it so that conversations stay grouped.

It's also how this message will be located in your mailbox.

{{sender_name}}`,
  },
  {
    id: "info-authentication",
    category: "informational",
    purpose: "Sharing useful information",
    subject: "SPF, DKIM and DMARC in brief",
    body: `Hello {{recipient_first_name}},

A short explainer, in case it's useful:

SPF lets a domain list the servers allowed to send its mail.
DKIM adds a cryptographic signature that a receiving server can verify.
DMARC tells receivers what to do when those checks fail, and where to send reports.

None of these are added by hand here. They come from the domain's DNS and the sending server for {{sender_domain}}.

Regards,
{{sender_name}}`,
  },
  {
    id: "info-plain-text",
    category: "informational",
    purpose: "Discussing an idea",
    subject: "A case for plain-text email",
    body: `Hi {{recipient_first_name}},

An idea I keep coming back to: plain-text messages like this one have real advantages. They display the same way in every client, they're readable on any device, and nothing in them depends on images or remote content loading.

The trade-off is formatting, but for short correspondence that rarely matters.

{{sender_name}}`,
  },
  {
    id: "info-time-zones",
    category: "informational",
    purpose: "Sharing useful information",
    subject: "How the sending window handles time zones",
    body: `{{recipient_first_name}},

A note on time zones: the sending window of {{active_window}} is measured in {{timezone}}, not in the server's own time. When daylight saving time begins or ends there, the window shifts with local time rather than staying fixed in UTC.

{{sender_name}}`,
  },
  {
    id: "info-junk-folder",
    category: "informational",
    purpose: "Providing an update",
    subject: "Why the Junk folder is checked too",
    body: `Hello {{recipient_first_name}},

An update on how arrival is confirmed: after a message is sent, {{recipient_email}} is searched over IMAP, first in the Inbox and then in the folder your provider marks as Junk.

Where the message is found is recorded exactly as observed. Nothing is moved, starred or marked on your behalf.

Best regards,
{{sender_name}}`,
  },
  {
    id: "info-gradual-volume",
    category: "informational",
    purpose: "Discussing an idea",
    subject: "Why volume increases slowly",
    body: `Hi {{recipient_first_name}},

The reason volume starts low and grows over several days: mailbox providers judge a sender partly by its history. A new or quiet address that suddenly sends a lot looks unusual, while a steady, gradual pattern looks like ordinary use.

That's why this mailbox will never exceed {{daily_limit}} messages a day.

{{sender_name}}`,
  },
  {
    id: "info-threading",
    category: "informational",
    purpose: "Sharing useful information",
    subject: "How replies stay in the same thread",
    body: `Hello {{recipient_first_name}},

Email threading relies on two headers. In-Reply-To names the Message-ID of the message being answered, and References lists the earlier messages in the conversation. Clients use them, and sometimes the subject line as well, to group a conversation together.

When you reply to this message, both headers are set automatically.

Regards,
{{sender_name}}`,
  },
  {
    id: "info-imap-smtp",
    category: "informational",
    purpose: "Responding to a question",
    subject: "SMTP and IMAP, side by side",
    body: `{{recipient_first_name}},

To answer the common question of why both settings are needed: SMTP is the protocol for sending mail, and IMAP is the protocol for reading a mailbox that stays on the server.

{{sender_email}} uses SMTP to send this message. {{recipient_email}} is read over IMAP to confirm that it arrived.

{{sender_name}}`,
  },
  {
    id: "info-bounces",
    category: "informational",
    purpose: "Sharing useful information",
    subject: "What a bounce actually means",
    body: `Hi {{recipient_first_name}},

A useful distinction: a "hard" bounce means the receiving server permanently refused a message, for example because the address doesn't exist. A "soft" bounce is temporary, such as a full mailbox or a busy server, and the sender may try again later.

Neither has happened with {{recipient_email}} as far as this message is concerned. If it had, you wouldn't be reading this.

{{sender_name}}`,
  },

  // ─── Technical test emails ────────────────────────────────────────────────
  {
    id: "tech-plain-text",
    category: "technical",
    purpose: "Plain-text test",
    subject: "Plain-text delivery check",
    body: `Hello {{recipient_first_name}},

This is a plain-text message with no HTML, images or attachments. It should appear exactly as written, including this list:

1. A numbered line
2. Another numbered line
   - An indented item

Line breaks and spacing should be preserved.

{{sender_name}}`,
  },
  {
    id: "tech-unicode",
    category: "technical",
    purpose: "Unicode characters",
    subject: "Unicode check: café, naïve, Zürich",
    body: `Hi {{recipient_first_name}},

This message checks that non-ASCII characters survive the trip. Each line below should look correct:

Accents: café, naïve, résumé, Zürich, São Paulo
Other alphabets: Ελληνικά, Русский, 日本語, 한국어, العربية
Symbols: € £ ¥ © ° ± × ÷ → ✓
Quotes and dashes: “double”, ‘single’, en – dash, em — dash

If any appear as question marks or boxes, the encoding was changed somewhere along the way.

{{sender_name}}`,
  },
  {
    id: "tech-short",
    category: "technical",
    purpose: "Different message lengths",
    subject: "Short message",
    body: `{{recipient_first_name}}, this is a one-line test of a very short message.

{{sender_name}}`,
  },
  {
    id: "tech-long",
    category: "technical",
    purpose: "Different message lengths",
    subject: "Longer message for layout testing",
    body: `Hello {{recipient_first_name}},

This message is deliberately longer than usual so you can see how a multi-paragraph email displays in your client. Its content describes the exchange it's part of.

Each message from {{sender_email}} is sent over that mailbox's own SMTP server, using its own credentials. Nothing about the sender is altered. The message carries a normal set of headers, including a unique Message-ID and a test identifier that lets it be matched later.

After sending, {{recipient_email}} is checked over IMAP at increasing intervals: within the first minute, then after a few minutes, and finally up to about two hours later. A message counts as delivered only when it's actually found. If it lands in the Junk folder, that's recorded honestly as well.

When replies are enabled, the target mailbox answers some of these messages from its own SMTP server. The replies reference the original Message-ID so they stay in the same thread.

Volume is kept low and grows gradually, and messages go out only between {{active_window}} in {{timezone}}, spaced at irregular intervals instead of all at once.

That is the whole of it. If this message wraps sensibly and the paragraphs stay separate, the longer-message test has passed.

Regards,
{{sender_name}}`,
  },
  {
    id: "tech-threading",
    category: "technical",
    purpose: "Email-threading verification",
    subject: "Threading check {{date}}",
    body: `Hi {{recipient_first_name}},

This message starts a thread for testing. When the reply arrives back at {{sender_email}}, it should appear under this message rather than as a separate conversation.

Reference for this thread: {{test_id}}

{{sender_name}}`,
  },
  {
    id: "tech-special-characters",
    category: "technical",
    purpose: "Plain-text test",
    subject: "Characters that need escaping: & < > \"",
    body: `Hello {{recipient_first_name}},

Some characters have special meaning in HTML and occasionally get mangled when a plain-text message is converted. They should all appear literally here:

Ampersand: &   Angle brackets: < >   Quotes: " '
Hash and percent: # %   Braces: { } [ ]   Backslash: \\

{{sender_name}}`,
  },
  {
    id: "tech-line-wrapping",
    category: "technical",
    purpose: "Different message lengths",
    subject: "Line wrapping test",
    body: `{{recipient_first_name}},

The next paragraph is written as one long line with no manual breaks, so your mail client decides where to wrap it. On a narrow phone screen it should wrap into several lines, and on a wide desktop window it may stay close to a single line, but either way no words should be cut in half.

A second, shorter paragraph follows to show that paragraph spacing survives.

{{sender_name}}`,
  },
  {
    id: "tech-identifier",
    category: "technical",
    purpose: "Plain-text test",
    subject: "Delivery check for {{test_id}}",
    body: `Hello {{recipient_first_name}},

This message has the test identifier {{test_id}}, which also appears in its X-Warmup-Test-ID header. It's used to find the message in {{recipient_email}} if the Message-ID search returns nothing.

Sent on {{date}} ({{timezone}}).

{{sender_name}}`,
  },
  {
    id: "tech-emoji",
    category: "technical",
    purpose: "Unicode characters",
    subject: "Emoji rendering check ✅",
    body: `Hi {{recipient_first_name}},

A quick check of emoji and other symbols outside the basic character set:

✅ check mark
📬 mailbox
🌍 globe
👍🏽 thumbs up with a skin-tone modifier

Some older clients show these as empty boxes, which is a display limitation rather than a delivery problem.

{{sender_name}}`,
  },
]

export const REPLY_TEMPLATES: ReplyTemplate[] = [
  // Casual
  {
    id: "casual-greeting.reply",
    replyTo: "casual-greeting",
    kind: "acknowledgement",
    body: `Hi {{recipient_first_name}},

Hello back from {{sender_email}}. Your note arrived fine.

{{sender_name}}`,
  },
  {
    id: "casual-subject-question.reply",
    replyTo: "casual-subject-question",
    kind: "answer",
    body: `Hi {{recipient_first_name}},

To your question: the subject "{{original_subject}}" is short enough that it shouldn't be cut off in most message lists. If it ever is, I'll mention it.

{{sender_name}}`,
  },
  {
    id: "casual-thanks.reply",
    replyTo: "casual-thanks",
    kind: "conclusion",
    body: `{{recipient_first_name}},

You're welcome. {{sender_email}} will stay connected, so there's nothing more to arrange.

{{sender_name}}`,
  },
  {
    id: "casual-weekday-update.reply",
    replyTo: "casual-weekday-update",
    kind: "acknowledgement",
    body: `Thanks, {{recipient_first_name}}. The {{active_window}} window and the limit of {{daily_limit}} a day are noted.

{{sender_name}}`,
  },
  {
    id: "casual-acknowledgement.reply",
    replyTo: "casual-acknowledgement",
    kind: "confirmation",
    body: `Hi {{recipient_first_name}},

Confirmed from this end as well. Your message reached {{sender_email}}, so the link between the two mailboxes works in both directions.

{{sender_name}}`,
  },
  {
    id: "casual-display-check.reply",
    replyTo: "casual-display-check",
    kind: "answer",
    body: `Hello {{recipient_first_name}},

How a sender is shown depends on the mail client. Some display only the address when no display name is set, so seeing just {{recipient_email}} would be expected. I'm replying so you can compare how this message appears on your side.

{{sender_name}}`,
  },
  {
    id: "casual-time-of-day.reply",
    replyTo: "casual-time-of-day",
    kind: "acknowledgement",
    body: `Good {{time_of_day}} to you too, {{recipient_first_name}}. It reached me.

{{sender_name}}`,
  },
  {
    id: "casual-reading-preference.reply",
    replyTo: "casual-reading-preference",
    kind: "answer",
    body: `Hi {{recipient_first_name}},

Short ones are easier to skim. A longer message works when there's genuinely more to say, but for routine notes a few lines is plenty.

{{sender_name}}`,
  },
  {
    id: "casual-check-in.reply",
    replyTo: "casual-check-in",
    kind: "acknowledgement",
    body: `Got it, {{recipient_first_name}}. This side is active too.

{{sender_name}}`,
  },

  // Professional
  {
    id: "pro-schedule-summary.reply",
    replyTo: "pro-schedule-summary",
    kind: "confirmation",
    body: `Hello {{recipient_first_name}},

Thanks for setting out the plan. To confirm what I understood: sending happens within {{active_window}} ({{timezone}}), with no more than {{daily_limit}} messages, and each one is checked in the Inbox and Junk folder.

No questions from my side.

Regards,
{{sender_name}}`,
  },
  {
    id: "pro-review-time.reply",
    replyTo: "pro-review-time",
    kind: "answer",
    body: `Hi {{recipient_first_name}},

A review makes sense once there are a few days of results to look at. Until then, the delivery track in the dashboard shows each message as it happens, which is probably enough.

Thanks,
{{sender_name}}`,
  },
  {
    id: "pro-folder-clarification.reply",
    replyTo: "pro-folder-clarification",
    kind: "answer",
    body: `Hello {{recipient_first_name}},

Good question. Any filter that moves incoming mail out of the Inbox would stop these messages from being found, so it's best to check the mailbox settings for {{sender_email}} and make sure nothing redirects mail from {{recipient_email}}.

If a rule like that exists, pausing it while warmup runs will keep the results accurate.

Best,
{{sender_name}}`,
  },
  {
    id: "pro-follow-up.reply",
    replyTo: "pro-follow-up",
    kind: "acknowledgement",
    body: `Hi {{recipient_first_name}},

Thanks for following up. A steady pace sounds right, and I'll flag anything unusual if I see it.

{{sender_name}}`,
  },
  {
    id: "pro-share-details.reply",
    replyTo: "pro-share-details",
    kind: "confirmation",
    body: `Hello {{recipient_first_name}},

Thanks for the details. They match what I have: messages come from {{recipient_email}} to {{sender_email}} within {{active_window}}. Good to know no passwords are ever included.

Regards,
{{sender_name}}`,
  },
  {
    id: "pro-week-check.reply",
    replyTo: "pro-week-check",
    kind: "acknowledgement",
    body: `{{recipient_first_name}},

Noted, thank you. I'll wait for your next note if the schedule changes.

{{sender_name}}`,
  },
  {
    id: "pro-reply-request.reply",
    replyTo: "pro-reply-request",
    kind: "confirmation",
    body: `Hi {{recipient_first_name}},

Here's the reply you asked for. It should appear in the same thread as "{{original_subject}}" when it reaches {{recipient_email}}.

{{sender_name}}`,
  },
  {
    id: "pro-schedule-change.reply",
    replyTo: "pro-schedule-change",
    kind: "answer",
    body: `Hello {{recipient_first_name}},

The current window of {{active_window}} is fine as it is, so no change is needed. Thanks for checking first.

Regards,
{{sender_name}}`,
  },
  {
    id: "pro-thanks-and-next.reply",
    replyTo: "pro-thanks-and-next",
    kind: "conclusion",
    body: `Hi {{recipient_first_name}},

Thanks for explaining the next steps. A gradual increase up to {{daily_limit}} a day sounds sensible. Nothing else is needed from me for now.

Best,
{{sender_name}}`,
  },

  // Informational
  {
    id: "info-message-id.reply",
    replyTo: "info-message-id",
    kind: "acknowledgement",
    body: `Hi {{recipient_first_name}},

That's a helpful explanation. It also explains how this reply gets attached to your message: it points back to the Message-ID of the one you sent.

{{sender_name}}`,
  },
  {
    id: "info-authentication.reply",
    replyTo: "info-authentication",
    kind: "answer",
    body: `Hello {{recipient_first_name}},

Thanks for the summary. If it helps, most mail clients can show the original message source, where the results of these checks appear in the Authentication-Results header. That's the quickest way to see whether SPF, DKIM and DMARC passed for a particular message.

Regards,
{{sender_name}}`,
  },
  {
    id: "info-plain-text.reply",
    replyTo: "info-plain-text",
    kind: "answer",
    body: `Hi {{recipient_first_name}},

I agree, mostly. Plain text is reliable and easy to read. The one thing I'd add is that long URLs can be awkward without link formatting, so plain text suits messages like these, which don't need links at all.

{{sender_name}}`,
  },
  {
    id: "info-time-zones.reply",
    replyTo: "info-time-zones",
    kind: "acknowledgement",
    body: `{{recipient_first_name}},

Good to know the window follows {{timezone}} through daylight saving changes. That avoids messages suddenly arriving an hour early or late.

{{sender_name}}`,
  },
  {
    id: "info-junk-folder.reply",
    replyTo: "info-junk-folder",
    kind: "confirmation",
    body: `Hello {{recipient_first_name}},

Understood. Since this mailbox is only searched and never changed, anything that ends up in Junk stays where the provider put it, and the results reflect what really happened.

Thanks,
{{sender_name}}`,
  },
  {
    id: "info-gradual-volume.reply",
    replyTo: "info-gradual-volume",
    kind: "acknowledgement",
    body: `Hi {{recipient_first_name}},

That reasoning makes sense. A gradual pattern is more like normal use than a sudden jump.

{{sender_name}}`,
  },
  {
    id: "info-threading.reply",
    replyTo: "info-threading",
    kind: "confirmation",
    body: `Hello {{recipient_first_name}},

This reply is a live example of what you described: its In-Reply-To and References headers point to your message, so it should sit in the same thread as "{{original_subject}}".

Regards,
{{sender_name}}`,
  },
  {
    id: "info-imap-smtp.reply",
    replyTo: "info-imap-smtp",
    kind: "acknowledgement",
    body: `{{recipient_first_name}},

Clear explanation, thanks. And since this reply goes back from {{sender_email}}, it uses SMTP on this side too.

{{sender_name}}`,
  },
  {
    id: "info-bounces.reply",
    replyTo: "info-bounces",
    kind: "conclusion",
    body: `Hi {{recipient_first_name}},

Thanks, the hard/soft distinction is useful to have written down. And you're right: your message arrived, so nothing bounced. That wraps it up from my side.

{{sender_name}}`,
  },

  // Technical
  {
    id: "tech-plain-text.reply",
    replyTo: "tech-plain-text",
    kind: "confirmation",
    body: `Hello {{recipient_first_name}},

Your plain-text message arrived. This reply is plain text as well, so its spacing should be preserved in the same way.

{{sender_name}}`,
  },
  {
    id: "tech-unicode.reply",
    replyTo: "tech-unicode",
    kind: "confirmation",
    body: `Hi {{recipient_first_name}},

Replying with a few of the same characters so the return trip is tested too: café, Zürich, 日本語, € and “quotes”.

Check that they look right when this reaches {{recipient_email}}.

{{sender_name}}`,
  },
  {
    id: "tech-short.reply",
    replyTo: "tech-short",
    kind: "acknowledgement",
    body: `Received. Short reply to match.

{{sender_name}}`,
  },
  {
    id: "tech-long.reply",
    replyTo: "tech-long",
    kind: "answer",
    body: `Hello {{recipient_first_name}},

The longer message arrived in one piece. In return, here's a summary of what it described, in case it's useful as a reference:

1. Sending uses the mailbox's own SMTP server and credentials.
2. Arrival is confirmed only by finding the message over IMAP.
3. Junk-folder placement is recorded as observed.
4. Replies stay in the original thread.
5. Volume rises gradually and stays within {{active_window}}.

Regards,
{{sender_name}}`,
  },
  {
    id: "tech-threading.reply",
    replyTo: "tech-threading",
    kind: "confirmation",
    body: `Hi {{recipient_first_name}},

This is the reply for thread {{test_id}}. If it shows under "{{original_subject}}" in your mail client, threading works in both directions.

{{sender_name}}`,
  },
  {
    id: "tech-special-characters.reply",
    replyTo: "tech-special-characters",
    kind: "confirmation",
    body: `Hello {{recipient_first_name}},

Those characters arrived intact here. Sending a few back the other way: & < > " { } \\

{{sender_name}}`,
  },
  {
    id: "tech-line-wrapping.reply",
    replyTo: "tech-line-wrapping",
    kind: "acknowledgement",
    body: `{{recipient_first_name}},

The long paragraph arrived as written. How it wraps is up to each client, but nothing in the text itself was broken.

{{sender_name}}`,
  },
  {
    id: "tech-identifier.reply",
    replyTo: "tech-identifier",
    kind: "confirmation",
    body: `Hello {{recipient_first_name}},

Confirming receipt of the message with identifier {{test_id}}. This reply carries the same identifier in its headers.

{{sender_name}}`,
  },
  {
    id: "tech-emoji.reply",
    replyTo: "tech-emoji",
    kind: "answer",
    body: `Hi {{recipient_first_name}},

The emoji came through. Sending two back so the reverse direction is covered: 📬 ✅

{{sender_name}}`,
  },
]
