import type { Mailbox, MailboxType, Prisma } from "@prisma/client"
import { prisma } from "../../db/prisma"

export const mailboxRepository = {
  listByUser(userId: string) {
    return prisma.mailbox.findMany({ where: { userId }, orderBy: { type: "asc" } })
  },

  findOwned(userId: string, id: string) {
    return prisma.mailbox.findFirst({ where: { id, userId } })
  },

  findByType(userId: string, type: MailboxType) {
    return prisma.mailbox.findUnique({ where: { userId_type: { userId, type } } })
  },

  create(data: Prisma.MailboxUncheckedCreateInput) {
    return prisma.mailbox.create({ data })
  },

  update(id: string, data: Prisma.MailboxUncheckedUpdateInput) {
    return prisma.mailbox.update({ where: { id }, data })
  },

  delete(id: string) {
    return prisma.mailbox.delete({ where: { id } })
  },
}

/** API representation of a mailbox. Encrypted secrets never leave the server. */
export function toPublicMailbox(m: Mailbox) {
  const { encryptedSmtpPassword, encryptedImapPassword, userId: _userId, ...rest } = m
  return {
    ...rest,
    hasSmtpPassword: Boolean(encryptedSmtpPassword),
    hasImapPassword: Boolean(encryptedImapPassword),
  }
}
