'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollText, Archive, Bell, ShieldCheck } from 'lucide-react'
import { LiveLogsTab } from './live-logs-tab'
import { ArchivesTab } from './archives-tab'
import { AlertConfigTab } from './alert-config-tab'
import { IntegrityTab } from './integrity-tab'

export function AuditLogDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted p-2 mt-0.5">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Audit Log</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Complete, tamper-evident record of all activity in your organization.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-xs font-medium"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            SOC 2 Compliant
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="live" className="space-y-5">
        <TabsList className="h-9 bg-muted/60 border border-border-subtle">
          <TabsTrigger value="live" className="gap-1.5 text-xs sm:text-sm">
            <ScrollText className="h-3.5 w-3.5" />
            Live Logs
          </TabsTrigger>
          <TabsTrigger value="archives" className="gap-1.5 text-xs sm:text-sm">
            <Archive className="h-3.5 w-3.5" />
            Archives
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5 text-xs sm:text-sm">
            <Bell className="h-3.5 w-3.5" />
            Alert Rules
          </TabsTrigger>
          <TabsTrigger value="integrity" className="gap-1.5 text-xs sm:text-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            Integrity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-0">
          <LiveLogsTab />
        </TabsContent>

        <TabsContent value="archives" className="mt-0">
          <ArchivesTab />
        </TabsContent>

        <TabsContent value="alerts" className="mt-0">
          <AlertConfigTab />
        </TabsContent>

        <TabsContent value="integrity" className="mt-0">
          <IntegrityTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
