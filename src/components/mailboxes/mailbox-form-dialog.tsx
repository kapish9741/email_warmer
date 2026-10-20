"use client"

import { useEffect } from "react"
import { Controller, useForm, type Path, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Inbox, Loader2, Mail } from "lucide-react"
import { api } from "@/lib/api"
import type { MailSecurity, Mailbox, MailboxInput, MailboxType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

const SECURITY_OPTIONS: { value: MailSecurity; label: string }[] = [
  { value: "SSL", label: "SSL/TLS" },
  { value: "STARTTLS", label: "STARTTLS" },
  { value: "NONE", label: "None" },
]

const formSchema = z.object({
  type: z.enum(["WARMUP", "TARGET"]),
  email: z.string().trim().email("Enter a valid email address"),
  smtpHost: z.string().trim(),
  smtpPort: z.string().trim(),
  smtpSecurity: z.enum(["SSL", "STARTTLS", "NONE"]),
  smtpUsername: z.string().trim(),
  smtpPassword: z.string(),
  imapHost: z.string().trim(),
  imapPort: z.string().trim(),
  imapSecurity: z.enum(["SSL", "STARTTLS", "NONE"]),
  imapUsername: z.string().trim(),
  imapPassword: z.string(),
  smtpEnabled: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

/** Role-dependent rules: SMTP for the warmup mailbox (and target replies), IMAP for the target. Saved passwords may be left blank on edit. */
function buildSchema(editing: Mailbox | null) {
  return formSchema.superRefine((v, ctx) => {
    const req = (path: keyof FormValues, message: string) => ctx.addIssue({ code: "custom", path: [path], message })
    const port = (path: "smtpPort" | "imapPort") => {
      const n = Number(v[path])
      if (!v[path]) req(path, "Port is required")
      else if (!Number.isInteger(n) || n < 1 || n > 65535) req(path, "Port must be between 1 and 65535")
    }
    const host = (path: "smtpHost" | "imapHost") => {
      if (!v[path]) req(path, "Host is required")
      else if (!/^[a-zA-Z0-9.-]+$/.test(v[path])) req(path, "Enter a hostname, e.g. mail.example.com")
    }
    if (v.type === "WARMUP" || v.smtpEnabled) {
      host("smtpHost")
      port("smtpPort")
      if (!v.smtpUsername) req("smtpUsername", "Username is required")
      if (!v.smtpPassword && !editing?.hasSmtpPassword) req("smtpPassword", "Password is required")
    }
    if (v.type === "TARGET") {
      host("imapHost")
      port("imapPort")
      if (!v.imapUsername) req("imapUsername", "Username is required")
      if (!v.imapPassword && !editing?.hasImapPassword) req("imapPassword", "Password is required")
    }
  })
}

function defaults(type: MailboxType, m: Mailbox | null): FormValues {
  return {
    type,
    email: m?.email ?? "",
    smtpHost: m?.smtpHost ?? "",
    smtpPort: m?.smtpPort ? String(m.smtpPort) : "587",
    smtpSecurity: m?.smtpSecurity ?? "STARTTLS",
    smtpUsername: m?.smtpUsername ?? "",
    smtpPassword: "",
    imapHost: m?.imapHost ?? "",
    imapPort: m?.imapPort ? String(m.imapPort) : "993",
    imapSecurity: m?.imapSecurity ?? "SSL",
    imapUsername: m?.imapUsername ?? "",
    imapPassword: "",
    smtpEnabled: type === "WARMUP" ? true : Boolean(m?.smtpEnabled),
  }
}

function TextField({
  form,
  name,
  label,
  placeholder,
  type = "text",
  description,
  autoComplete,
}: {
  form: UseFormReturn<FormValues>
  name: Path<FormValues>
  label: string
  placeholder: string
  type?: string
  description?: string
  autoComplete?: string
}) {
  return (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            id={name}
            type={type}
            placeholder={placeholder}
            autoComplete={autoComplete ?? "off"}
            value={field.value as string}
            onChange={field.onChange}
            onBlur={field.onBlur}
            aria-invalid={fieldState.invalid}
          />
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : description && <FieldDescription className="text-xs">{description}</FieldDescription>}
        </Field>
      )}
    />
  )
}

function SecurityField({ form, name, label, onPick }: { form: UseFormReturn<FormValues>; name: "smtpSecurity" | "imapSecurity"; label: string; onPick: (v: MailSecurity) => void }) {
  return (
    <Controller
      name={name}
      control={form.control}
      render={({ field }) => (
        <Field>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Select
            items={SECURITY_OPTIONS}
            value={field.value}
            onValueChange={(v) => {
              if (!v) return
              field.onChange(v)
              onPick(v as MailSecurity)
            }}
          >
            <SelectTrigger id={name} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SECURITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}
    />
  )
}

function ServerFields({ form, protocol, editing }: { form: UseFormReturn<FormValues>; protocol: "smtp" | "imap"; editing: Mailbox | null }) {
  const P = protocol.toUpperCase()
  const hasSaved = protocol === "smtp" ? editing?.hasSmtpPassword : editing?.hasImapPassword
  // Suggest the conventional port for the chosen security, unless the user typed a custom one.
  const conventional = protocol === "smtp" ? { SSL: "465", STARTTLS: "587", NONE: "25" } : { SSL: "993", STARTTLS: "143", NONE: "143" }
  const onPick = (v: MailSecurity) => {
    const portKey = `${protocol}Port` as const
    if (Object.values(conventional).includes(form.getValues(portKey))) form.setValue(portKey, conventional[v], { shouldDirty: true })
  }
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_96px]">
        <TextField form={form} name={`${protocol}Host`} label={`${P} Host`} placeholder={`${protocol}.yourdomain.com`} />
        <TextField form={form} name={`${protocol}Port`} label={`${P} Port`} placeholder={conventional.SSL} />
      </div>
      <SecurityField form={form} name={`${protocol}Security`} label="Security" onPick={onPick} />
      <TextField form={form} name={`${protocol}Username`} label={`${P} Username`} placeholder="Usually the full email address" />
      <TextField
        form={form}
        name={`${protocol}Password`}
        type="password"
        autoComplete="new-password"
        label={`${P} Password`}
        placeholder={hasSaved ? "Password saved. Leave blank to keep" : "App password or mailbox password"}
        description="Encrypted on the server. It is never shown again."
      />
    </>
  )
}

export function MailboxFormDialog({
  open,
  onOpenChange,
  type,
  mailbox,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: MailboxType
  mailbox: Mailbox | null
  onSaved: (mailbox: Mailbox) => void
}) {
  const form = useForm<FormValues>({ resolver: zodResolver(buildSchema(mailbox)), defaultValues: defaults(type, mailbox) })

  useEffect(() => {
    if (open) form.reset(defaults(type, mailbox))
  }, [open, type, mailbox, form])

  const values = form.watch()
  const isTarget = values.type === "TARGET"

  const onSubmit = async (v: FormValues) => {
    const useSmtp = v.type === "WARMUP" || v.smtpEnabled
    const payload: MailboxInput = {
      email: v.email,
      ...(v.type === "TARGET" ? { smtpEnabled: v.smtpEnabled } : {}),
      ...(useSmtp
        ? { smtpHost: v.smtpHost, smtpPort: Number(v.smtpPort), smtpSecurity: v.smtpSecurity, smtpUsername: v.smtpUsername, ...(v.smtpPassword ? { smtpPassword: v.smtpPassword } : {}) }
        : {}),
      ...(v.type === "TARGET"
        ? { imapHost: v.imapHost, imapPort: Number(v.imapPort), imapSecurity: v.imapSecurity, imapUsername: v.imapUsername, ...(v.imapPassword ? { imapPassword: v.imapPassword } : {}) }
        : {}),
    }
    const res = mailbox ? await api.updateMailbox(mailbox.id, payload) : await api.createMailbox({ ...payload, type: v.type })
    if (!res.success) {
      for (const f of res.error.details?.fields ?? []) {
        if (f.path in v) form.setError(f.path as keyof FormValues, { message: f.message })
      }
      toast.error(res.error.message)
      return
    }
    toast.success(mailbox ? "Mailbox updated. Run Test Connection to verify the new settings" : "Mailbox saved. Run Test Connection to verify it")
    onSaved(res.data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isTarget ? <Inbox className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            {mailbox ? "Edit" : "Connect"} {isTarget ? "Target Mailbox (B)" : "Warmup Mailbox (A)"}
          </DialogTitle>
          <DialogDescription>
            {isTarget
              ? "The mailbox that receives warmup messages. Its inbox is checked over IMAP to confirm real delivery."
              : "The mailbox being warmed up. Warmup messages are sent through its own SMTP server."}
          </DialogDescription>
        </DialogHeader>

        <form id="mailbox-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup className="gap-5">
            <TextField form={form} name="email" type="email" label="Email Address" placeholder="name@yourdomain.com" autoComplete="email" />

            {!isTarget && (
              <FieldSet className="gap-3 rounded-lg border border-border p-3">
                <FieldLegend variant="label" className="text-xs text-muted-foreground">Outgoing (SMTP)</FieldLegend>
                <ServerFields form={form} protocol="smtp" editing={mailbox} />
              </FieldSet>
            )}

            {isTarget && (
              <>
                <FieldSet className="gap-3 rounded-lg border border-border p-3">
                  <FieldLegend variant="label" className="text-xs text-muted-foreground">Incoming (IMAP)</FieldLegend>
                  <ServerFields form={form} protocol="imap" editing={mailbox} />
                </FieldSet>

                <FieldSet className="gap-3 rounded-lg border border-border p-3">
                  <Controller
                    name="smtpEnabled"
                    control={form.control}
                    render={({ field }) => (
                      <Field orientation="horizontal" className="justify-between">
                        <FieldContent>
                          <FieldLabel htmlFor="smtpEnabled">Enable Replies</FieldLabel>
                          <FieldDescription className="text-xs">Lets the target mailbox send real replies back over its own SMTP server.</FieldDescription>
                        </FieldContent>
                        <Switch id="smtpEnabled" checked={field.value} onCheckedChange={field.onChange} />
                      </Field>
                    )}
                  />
                  {values.smtpEnabled && <ServerFields form={form} protocol="smtp" editing={mailbox} />}
                </FieldSet>
              </>
            )}
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="mailbox-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mailbox ? "Save Changes" : "Save Mailbox"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
