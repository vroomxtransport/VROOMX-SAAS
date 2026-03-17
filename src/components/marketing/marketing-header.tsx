'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Sheet, SheetContent, SheetFooter, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button, buttonVariants } from '@/components/ui/button'
import { MenuToggle } from '@/components/ui/menu-toggle'
import { cn } from '@/lib/utils'

const links = [
  { label: 'Features', href: '#features' },
  { label: 'Product', href: '#product' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

export function MarketingHeader() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'bg-background/80 backdrop-blur-lg border-b border-border-subtle shadow-sm'
          : 'bg-transparent',
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/logo-white.png"
              alt="VroomX TMS"
              width={200}
              height={56}
              className="h-[132px] w-auto brightness-0"
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
                  className:
                    'text-black hover:text-black/80 hover:bg-black/5',
                })}
              >
                {link.label}
              </Link>
            ))}
            <div className="ml-4 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-black hover:text-black/80"
              >
                <Link href="/login">Log in</Link>
              </Button>
              <Button
                size="sm"
                asChild
                className="bg-brand text-white font-semibold hover:bg-brand/90 shadow-md"
              >
                <Link href="/signup">Start Free Trial</Link>
              </Button>
            </div>
          </div>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden text-foreground hover:bg-foreground/5"
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
              aria-describedby={undefined}
            >
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">Main navigation links</SheetDescription>
              <div className="flex items-center border-b px-4 py-4">
                <Image
                  src="/images/logo-white.png"
                  alt="VroomX TMS"
                  width={180}
                  height={56}
                  className="h-[132px] w-auto brightness-0"
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
                  <Link href="/login" onClick={() => setOpen(false)}>
                    Log in
                  </Link>
                </Button>
                <Button
                  asChild
                  className="w-full bg-brand text-white hover:bg-brand/90"
                >
                  <Link href="/signup" onClick={() => setOpen(false)}>
                    Start Free Trial
                  </Link>
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </header>
  )
}
