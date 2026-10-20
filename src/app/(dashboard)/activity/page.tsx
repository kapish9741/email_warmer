"use client"

import { useMemo, useState } from "react"
import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import { Activity, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { api } from "@/lib/api"
import { describeEvent, formatDateTime, MESSAGE_STATUS_LABELS, messageStatusVariant } from "@/lib/format"
import type { MessageStatus, MessageType, WarmupMessage } from "@/lib/types"
import { useApi } from "@/hooks/use-api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const STATUS_ITEMS = [
  { value: "ALL", label: "All statuses" },
  ...(["SCHEDULED", "SENDING", "SENT", "RECEIVED", "REPLY_SENT", "FAILED", "TIMEOUT"] as MessageStatus[]).map((s) => ({ value: s, label: MESSAGE_STATUS_LABELS[s] })),
]
const TYPE_ITEMS = [
  { value: "ALL", label: "All types" },
  { value: "WARMUP", label: "Warmup" },
  { value: "TEST", label: "Test send" },
]
const DATE_ITEMS = [
  { value: "ALL", label: "All time" },
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
]

function FilterSelect({ items, value, onChange, label }: { items: { value: string; label: string }[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-36 text-xs" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>{items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
    </Select>
  )
}

function MessageDetailDialog({ messageId, onClose }: { messageId: string | null; onClose: () => void }) {
  const { data } = useApi(() => (messageId ? api.getMessage(messageId) : Promise.resolve({ success: false as const, error: { code: "NONE", message: "" } })), {
    deps: [messageId],
    pollMs: messageId ? 10_000 : undefined,
  })
  const message = data && data.id === messageId ? data : null
  return (
    <Dialog open={messageId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{message?.testId ?? "Loading…"}</DialogTitle>
          <DialogDescription className="truncate">{message?.subject}</DialogDescription>
        </DialogHeader>
        {message && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div><p className="text-muted-foreground">From</p><p className="font-medium truncate">{message.from}</p></div>
              <div><p className="text-muted-foreground">To</p><p className="font-medium truncate">{message.to}</p></div>
              <div><p className="text-muted-foreground">Status</p><Badge variant={messageStatusVariant(message.status)}>{MESSAGE_STATUS_LABELS[message.status]}</Badge></div>
              <div><p className="text-muted-foreground">Placement</p><p className="font-medium">{message.placement ? `${message.placement === "SPAM" ? "Spam" : "Inbox"} (${message.folder})` : "Not observed yet"}</p></div>
              <div className="col-span-2"><p className="text-muted-foreground">Message-ID</p><p className="font-mono break-all">{message.messageId ?? "—"}</p></div>
              {message.errorMessage && <div className="col-span-2"><p className="text-muted-foreground">Error</p><p className="font-medium">{message.errorMessage} ({message.errorCode})</p></div>}
              {message.replyError && <div className="col-span-2"><p className="text-muted-foreground">Reply error</p><p className="font-medium">{message.replyError}</p></div>}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Event trail</p>
              <ol className="space-y-2 border-l border-border pl-4">
                {message.events.map((evt) => {
                  const { title, detail } = describeEvent(evt)
                  return (
                    <li key={evt.id} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-foreground" />
                      <p className={evt.type === "FAILED" ? "font-semibold" : "font-medium"}>{title}</p>
                      <p className="text-muted-foreground">{formatDateTime(evt.createdAt)}{detail ? ` · ${detail}` : ""}</p>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function ActivityPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [dateFilter, setDateFilter] = useState("ALL")
  const [selected, setSelected] = useState<string | null>(null)

  const from = dateFilter === "ALL" ? undefined : new Date(Date.now() - Number(dateFilter) * 86_400_000).toISOString()
  const { data, loading } = useApi(
    () =>
      api.getMessages({
        status: statusFilter === "ALL" ? undefined : (statusFilter as MessageStatus),
        type: typeFilter === "ALL" ? undefined : (typeFilter as MessageType),
        from,
        limit: 1000,
      }),
    { pollMs: 15_000, deps: [statusFilter, typeFilter, dateFilter] },
  )

  const filteredData = useMemo(() => {
    const rows = data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((m) => [m.subject, m.testId, m.messageId ?? "", m.from, m.to].some((v) => v.toLowerCase().includes(q)))
  }, [data, search])

  const columns = useMemo<ColumnDef<WarmupMessage>[]>(
    () => [
      {
        id: "time",
        header: "Time",
        cell: ({ row }) => <span className="text-xs font-mono whitespace-nowrap">{formatDateTime(row.original.sentAt ?? row.original.scheduledAt)}</span>,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: (info) => <Badge variant="outline" className="text-xs">{info.getValue() === "TEST" ? "Test" : "Warmup"}</Badge>,
      },
      { accessorKey: "from", header: "From", cell: (info) => <span className="text-xs font-medium">{info.getValue() as string}</span> },
      { accessorKey: "to", header: "To", cell: (info) => <span className="text-xs text-muted-foreground">{info.getValue() as string}</span> },
      { accessorKey: "subject", header: "Subject", cell: (info) => <span className="text-xs font-medium">{info.getValue() as string}</span> },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Badge variant={messageStatusVariant(row.original.status)} className="text-xs font-mono">{MESSAGE_STATUS_LABELS[row.original.status]}</Badge>
            {row.original.placement === "SPAM" && <Badge variant="outline" className="text-xs">Spam</Badge>}
          </div>
        ),
      },
      {
        accessorKey: "messageId",
        header: "Message ID",
        cell: (info) => (
          <span className="text-xs font-mono text-muted-foreground truncate max-w-[160px] inline-block align-middle" title={(info.getValue() as string) ?? undefined}>
            {(info.getValue() as string) || "—"}
          </span>
        ),
      },
    ],
    [],
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    initialState: { pagination: { pageSize: 15 } },
  })

  return (
    <div className="flex flex-col gap-6 w-full pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">Detailed log of scheduled, sent, received, and replied warmup messages.</p>
      </div>

      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-border/50">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2"><Activity className="h-5 w-5" /> Activity Log</CardTitle>
            <CardDescription className="text-xs">Every row is an actual backend message record. Select a row to see its event trail.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 min-w-48 lg:w-64">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search subject, ID, or email..." aria-label="Search messages" value={search} onChange={(e) => { setSearch(e.target.value); table.setPageIndex(0) }} className="pl-8 text-xs" />
            </div>
            <FilterSelect label="Status filter" items={STATUS_ITEMS} value={statusFilter} onChange={(v) => { setStatusFilter(v); table.setPageIndex(0) }} />
            <FilterSelect label="Type filter" items={TYPE_ITEMS} value={typeFilter} onChange={(v) => { setTypeFilter(v); table.setPageIndex(0) }} />
            <FilterSelect label="Date filter" items={DATE_ITEMS} value={dateFilter} onChange={(v) => { setDateFilter(v); table.setPageIndex(0) }} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((h) => (
                    <TableHead key={h.id} className="text-sm font-semibold">{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-10 text-xs text-muted-foreground">
                    {loading ? "Loading…" : data && data.length > 0 ? "No messages match your filters." : "No activity yet."}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/40"
                    tabIndex={0}
                    onClick={() => setSelected(row.original.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelected(row.original.id))}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="p-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <div>Showing {table.getRowModel().rows.length} of {filteredData.length} records</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="Previous page" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="Next page" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <MessageDetailDialog messageId={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
