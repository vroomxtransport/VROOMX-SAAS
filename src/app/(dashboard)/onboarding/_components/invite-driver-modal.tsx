'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { inviteDriverApplicationSchema, type InviteDriverApplicationInput } from '@/lib/validations/driver-application'
import { inviteDriverApplication } from '@/app/actions/driver-applications'

interface InviteDriverModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SuccessState = {
  applicationUrl: string
  emailSent: boolean
  email: string
}

export function InviteDriverModal({ open, onOpenChange }: InviteDriverModalProps) {
  const queryClient = useQueryClient()
  const [view, setView] = useState<'form' | 'success'>('form')
  const [successData, setSuccessData] = useState<SuccessState | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const form = useForm<InviteDriverApplicationInput>({
    resolver: zodResolver(inviteDriverApplicationSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    },
  })

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(data: InviteDriverApplicationInput) {
    setServerError(null)
    const result = await inviteDriverApplication(data)

    if ('error' in result) {
      setServerError(result.error)
      return
    }

    setSuccessData({
      applicationUrl: result.applicationUrl,
      emailSent: result.emailSent,
      email: data.email,
    })
    setView('success')
    // Invalidate the applications list so the new draft appears immediately
    queryClient.invalidateQueries({ queryKey: ['applications'] })
  }

  function handleSendAnother() {
    form.reset()
    setServerError(null)
    setSuccessData(null)
    setCopied(false)
    setView('form')
  }

  function handleDone() {
    onOpenChange(false)
    // Reset after the dialog close animation completes
    setTimeout(() => {
      form.reset()
      setServerError(null)
      setSuccessData(null)
      setCopied(false)
      setView('form')
    }, 300)
  }

  async function handleCopyLink() {
    if (!successData) return
    try {
      await navigator.clipboard.writeText(successData.applicationUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may be blocked in some contexts; silent fail
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {view === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Invite Driver to Apply</DialogTitle>
              <DialogDescription>
                We&apos;ll email them a secure link to start their FMCSA application
              </DialogDescription>
            </DialogHeader>

            {serverError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Jane" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Smith" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="jane.smith@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="(555) 867-5309"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="mt-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending\u2026' : 'Send Invitation'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="mb-3 flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <DialogTitle className="text-center">
                {successData?.emailSent ? 'Invitation sent' : 'Invitation ready'}
              </DialogTitle>
              <DialogDescription className="text-center">
                {successData?.emailSent
                  ? `We emailed ${successData.email} a secure application link. They have 72 hours to start their application.`
                  : `Email delivery is not configured. Copy the link below and send it to ${successData?.email} manually.`}
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2">
              <Input
                readOnly
                value={successData?.applicationUrl ?? ''}
                className="font-mono text-xs"
                aria-label="Application link"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={handleCopyLink}
              >
                {copied ? 'Copied \u2713' : 'Copy link'}
              </Button>
            </div>

            <DialogFooter className="mt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSendAnother}
              >
                Send another
              </Button>
              <Button type="button" onClick={handleDone}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
