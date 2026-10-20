"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { User, Bell, Shield, Lock, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"

export default function SettingsPage() {
  const { user, logout } = useAuth()

  return (
    <div className="flex flex-col gap-6 w-full pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage system preferences, credential security, and notification options.
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full flex flex-col md:flex-row items-start gap-6">
        <TabsList className="flex flex-row md:flex-col justify-start h-auto bg-transparent p-0 w-full md:w-52 shrink-0 gap-1.5 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
          <TabsTrigger
            value="general"
            className="w-auto md:w-full justify-start h-9 flex-none px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted/60 data-active:bg-muted data-active:text-foreground data-active:shadow-none"
          >
            <User className="mr-2 h-4 w-4" /> General
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="w-auto md:w-full justify-start h-9 flex-none px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted/60 data-active:bg-muted data-active:text-foreground data-active:shadow-none"
          >
            <Shield className="mr-2 h-4 w-4" /> Security
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="w-auto md:w-full justify-start h-9 flex-none px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted/60 data-active:bg-muted data-active:text-foreground data-active:shadow-none"
          >
            <Bell className="mr-2 h-4 w-4" /> Notifications
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-w-0">
          <TabsContent value="general" className="m-0 focus-visible:outline-none">
            <Card className="rounded-xl border border-border bg-card shadow-xs">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Account</CardTitle>
                <CardDescription className="text-xs">The account that owns your two mailboxes and warmup schedule.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Account email</span>
                  <span className="font-medium text-foreground">{user.email}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Member since</span>
                  <span className="font-medium text-foreground">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</span>
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/50">
                <Button size="sm" variant="outline" onClick={logout}>Log out</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="m-0 focus-visible:outline-none">
            <Card className="rounded-xl border border-border bg-card shadow-xs">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Lock className="h-5 w-5" /> Credential Security & Encryption
                </CardTitle>
                <CardDescription className="text-xs">
                  All SMTP and IMAP passwords are encrypted at rest using AES-256-GCM.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-foreground" /> Zero Plaintext Storage Policy
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Mailbox passwords are encrypted server-side with an isolated initialization vector (IV) and authentication tag before write. Decrypted keys are used solely in transient worker memory during SMTP/IMAP operations and are never exposed to browser APIs or application logs.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Encryption Algorithm</span>
                    <span className="font-mono font-medium text-foreground">AES-256-GCM</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Account Password Hash</span>
                    <span className="font-mono font-medium text-foreground">bcrypt</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Frontend Password Exposure</span>
                    <span className="font-medium text-foreground font-mono">Redacted (••••••••)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="m-0 focus-visible:outline-none">
            <Card className="rounded-xl border border-border bg-card shadow-xs">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Notifications</CardTitle>
                <CardDescription className="text-xs">How you are alerted about connection drops and delivery failures.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between gap-4 py-2 border-b border-border/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">In-app failure alerts</p>
                    <p className="text-muted-foreground">Failures from the last 24 hours appear under the bell icon in the top bar.</p>
                  </div>
                  <span className="font-medium text-foreground shrink-0">Always on</span>
                </div>
                <div className="flex justify-between gap-4 py-2 border-b border-border/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">Automatic pause on authentication failure</p>
                    <p className="text-muted-foreground">If the warmup mailbox rejects its credentials, warmup pauses instead of failing every remaining send.</p>
                  </div>
                  <span className="font-medium text-foreground shrink-0">Always on</span>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Email notifications</p>
                    <p className="text-muted-foreground">Email alerts and daily summaries are not available yet.</p>
                  </div>
                  <span className="text-muted-foreground shrink-0">Not available</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
