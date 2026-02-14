"use client"

import { useState, type ReactNode } from "react"
import Image from "next/image"
import {
  Package,
  Navigation,
  Smartphone,
  CreditCard,
  Truck,
  Lock,
} from "lucide-react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface FeatureItem {
  id: number
  title: string
  description: string
  visual: ReactNode
}

/* ── Mini mockup panels ─────────────────────────────────────────────── */

function LoadManagementVisual() {
  return (
    <div className="flex h-full flex-col gap-2.5 rounded-xl bg-surface p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-blue-500/30" />
          <div className="h-2 w-20 rounded-full bg-foreground/15" />
        </div>
        <div className="h-6 w-20 rounded-md bg-brand/20" />
      </div>
      {/* Order cards */}
      {[
        { status: "bg-emerald-500", w: "w-3/4" },
        { status: "bg-amber-500", w: "w-1/2" },
        { status: "bg-blue-500", w: "w-full" },
      ].map((row, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border-subtle bg-background p-3"
        >
          <div className={`h-2 w-2 rounded-full ${row.status}`} />
          <div className="flex-1 space-y-1.5">
            <div className="h-2 w-24 rounded-full bg-foreground/12" />
            <div className={`h-1.5 ${row.w} rounded-full bg-muted-foreground/8`} />
          </div>
          <div className="h-5 w-16 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  )
}

function SmartDispatchVisual() {
  return (
    <Image
      src="/images/dispatch-board.png"
      alt="VroomX Smart Dispatch - Kanban board"
      width={1661}
      height={907}
      className="h-full w-full rounded-xl object-cover object-top"
    />
  )
}

function DriverAppVisual() {
  return (
    <div className="flex h-full items-center justify-center rounded-xl p-4">
      <Image
        src="/images/driver-app-inspection.png"
        alt="VroomX Driver App - Vehicle Inspection"
        width={140}
        height={280}
        className="h-full w-auto object-contain"
      />
    </div>
  )
}

function BillingVisual() {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl bg-surface p-4">
      {/* Invoice header */}
      <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-background p-3">
        <div className="space-y-1.5">
          <div className="h-2.5 w-28 rounded-full bg-foreground/15" />
          <div className="h-1.5 w-16 rounded-full bg-muted-foreground/10" />
        </div>
        <div className="h-7 w-20 rounded-md bg-emerald-500/15 flex items-center justify-center">
          <div className="h-1.5 w-10 rounded-full bg-emerald-500/40" />
        </div>
      </div>
      {/* Line items */}
      {[0.12, 0.1, 0.08].map((opacity, i) => (
        <div key={i} className="flex items-center gap-3 px-2">
          <div className="h-1.5 w-20 rounded-full" style={{ background: `rgba(0,0,0,${opacity})` }} />
          <div className="flex-1" />
          <div className="h-1.5 w-14 rounded-full" style={{ background: `rgba(0,0,0,${opacity * 0.7})` }} />
        </div>
      ))}
      {/* Total */}
      <div className="mt-auto flex items-center justify-between rounded-lg bg-brand/5 p-3">
        <div className="h-2 w-10 rounded-full bg-foreground/15" />
        <div className="h-3 w-20 rounded-full bg-brand/30" />
      </div>
    </div>
  )
}

function FleetVisual() {
  return (
    <div className="grid h-full grid-cols-2 gap-2 rounded-xl bg-surface p-3">
      {[
        { icon: "bg-blue-500/20", label: "Active", value: "12" },
        { icon: "bg-amber-500/20", label: "Maintenance", value: "3" },
        { icon: "bg-emerald-500/20", label: "Available", value: "8" },
        { icon: "bg-violet-500/20", label: "Drivers", value: "15" },
      ].map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col items-center justify-center rounded-lg border border-border-subtle bg-background p-3"
        >
          <div className={`h-8 w-8 rounded-lg ${stat.icon}`} />
          <div className="mt-2 text-lg font-bold text-foreground/80">{stat.value}</div>
          <div className="text-[10px] text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}

function SecurityVisual() {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl bg-surface p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
          <Lock className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="space-y-1">
          <div className="h-2 w-24 rounded-full bg-foreground/15" />
          <div className="h-1.5 w-16 rounded-full bg-emerald-500/20" />
        </div>
      </div>
      {/* Security rows */}
      {["Row-Level Security", "Role-Based Access", "Encrypted at Rest", "Audit Logging"].map(
        (item) => (
          <div
            key={item}
            className="flex items-center gap-2 rounded-lg border border-border-subtle bg-background px-3 py-2"
          >
            <div className="h-3 w-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </div>
            <span className="text-[11px] text-muted-foreground">{item}</span>
          </div>
        )
      )}
    </div>
  )
}

/* ── Feature data ───────────────────────────────────────────────────── */

const vroomxFeatures: FeatureItem[] = [
  {
    id: 1,
    title: "Load Management",
    description:
      "Create and track vehicle transport orders with VIN decoding, multi-step intake wizards, and real-time status updates from new to delivered.",
    visual: <LoadManagementVisual />,
  },
  {
    id: 2,
    title: "Smart Dispatch",
    description:
      "Build optimized trips, assign orders and drivers, visualize routes on a Kanban board, and auto-calculate driver pay across three pay models.",
    visual: <SmartDispatchVisual />,
  },
  {
    id: 3,
    title: "Driver Mobile App",
    description:
      "Native iOS app with offline-capable inspections, photo and video capture, digital BOL generation, and real-time order status updates.",
    visual: <DriverAppVisual />,
  },
  {
    id: 4,
    title: "Automated Billing",
    description:
      "Generate branded PDF invoices, send via email, record payments, and track receivables with aging analysis and collection metrics.",
    visual: <BillingVisual />,
  },
  {
    id: 5,
    title: "Fleet Operations",
    description:
      "Manage trucks, trailers, and drivers in one place. Track documents with expiry alerts, upload CDLs and medical cards, monitor fleet health.",
    visual: <FleetVisual />,
  },
  {
    id: 6,
    title: "Enterprise Security",
    description:
      "Row-level security isolates every carrier. Role-based access, team invitations, and SOC-2 aligned infrastructure you can trust.",
    visual: <SecurityVisual />,
  },
]

const featureIcons = [Package, Navigation, Smartphone, CreditCard, Truck, Lock]
const featureGradients = [
  "from-blue-500 to-blue-600",
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-blue-500",
  "from-emerald-500 to-green-600",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-600",
]

/* ── Component ──────────────────────────────────────────────────────── */

function Feature197({ features = vroomxFeatures }: { features?: FeatureItem[] }) {
  const [activeTabId, setActiveTabId] = useState<number>(1)

  const activeFeature = features.find((f) => f.id === activeTabId) ?? features[0]

  return (
    <section className="relative border-t border-border-subtle bg-muted/30 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand">
            Platform
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Everything you need to run your fleet
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From load intake to final payment — one platform, zero spreadsheets.
          </p>
        </div>

        {/* Accordion + Visual */}
        <div className="flex w-full items-start justify-between gap-12">
          <div className="w-full md:w-1/2">
            <Accordion
              type="single"
              className="w-full"
              defaultValue="item-1"
              onValueChange={(value) => {
                if (value) {
                  const id = parseInt(value.replace("item-", ""), 10)
                  setActiveTabId(id)
                }
              }}
            >
              {features.map((tab, idx) => {
                const Icon = featureIcons[idx] ?? Package
                return (
                  <AccordionItem
                    key={tab.id}
                    value={`item-${tab.id}`}
                    className="border-border-subtle"
                  >
                    <AccordionTrigger className="cursor-pointer py-5 !no-underline transition hover:!no-underline">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${featureGradients[idx] ?? "from-brand to-amber-500"}`}
                        >
                          <Icon className="h-4 w-4 text-white" strokeWidth={2.5} />
                        </div>
                        <h6
                          className={`text-left text-lg font-semibold transition-colors ${
                            tab.id === activeTabId
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {tab.title}
                        </h6>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="mt-1 pl-12 text-muted-foreground">
                        {tab.description}
                      </p>
                      {/* Mobile visual */}
                      <div className="mt-4 h-64 overflow-hidden rounded-xl border border-border-subtle bg-muted md:hidden">
                        {tab.visual}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </div>

          {/* Desktop visual panel */}
          <div className="relative m-auto hidden w-1/2 md:block">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border-subtle bg-muted shadow-sm">
              {activeFeature.visual}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export { Feature197 }
