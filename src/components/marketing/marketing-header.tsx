'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Sheet, SheetContent, SheetFooter } from '@/components/ui/sheet'
import { Button, buttonVariants } from '@/components/ui/button'
import { MenuToggle } from '@/components/ui/menu-toggle'

const links = [
  { label: 'Features', href: '#product' },
  { label: 'Pricing', href: '/pricing' },
]

export function MarketingHeader() {
  const [open, setOpen] = React.useState(false)

  return (
    <header className="absolute top-0 left-0 right-0 z-50 w-full">
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <nav className="flex h-14 items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 backdrop-blur-md">
        {/* Logo */}
        <Link href="/">
          <Image
            src="/images/logo-white.png"
            alt="VroomX TMS"
            width={144}
            height={48}
            className="h-11 w-auto"
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className: 'text-white/70 hover:text-white hover:bg-white/10',
              })}
            >
              {link.label}
            </Link>
          ))}
          <div className="ml-3 flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-white/80 hover:text-white hover:bg-white/10">
              <Link href="/login">Log in</Link>
            </Button>
            <Button size="sm" asChild className="bg-white text-black font-semibold hover:bg-white/90 shadow-[0_0_16px_rgba(255,255,255,0.15)]">
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden text-white hover:bg-white/10"
            onClick={() => setOpen(!open)}
          >
            <MenuToggle
              strokeWidth={2.5}
              open={open}
              onOpenChange={setOpen}
              className="size-5"
            />
          </Button>
          <SheetContent
            className="bg-background/95 supports-[backdrop-filter]:bg-background/80 gap-0 backdrop-blur-lg"
            showCloseButton={false}
            side="left"
          >
            {/* Mobile logo */}
            <div className="flex items-center border-b px-4 py-4">
              <Image
                src="/images/logo-white.png"
                alt="VroomX TMS"
                width={120}
                height={40}
                className="h-10 w-auto"
              />
            </div>
            <div className="grid gap-y-1 overflow-y-auto px-4 pt-4 pb-5">
              {links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={buttonVariants({
                    variant: 'ghost',
                    className: 'justify-start',
                  })}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <SheetFooter>
              <Button variant="outline" asChild className="w-full">
                <Link href="/login" onClick={() => setOpen(false)}>Log in</Link>
              </Button>
              <Button asChild className="w-full bg-brand text-white hover:bg-brand/90">
                <Link href="/signup" onClick={() => setOpen(false)}>Sign up</Link>
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </nav>
      </div>
    </header>
  )
}
