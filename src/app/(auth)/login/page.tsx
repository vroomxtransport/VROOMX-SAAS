'use client'

import { loginAction, magicLinkAction } from '@/app/actions/auth'
import { AnimatedInput, BoxReveal, BottomGradient, AnimatedLabel } from '@/components/blocks/modern-animated-sign-in'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import Image from 'next/image'
import { useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Eye, EyeOff } from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite_token')
  const error = searchParams.get('error')
  const [state, formAction, isPending] = useActionState(loginAction, null)
  const [magicState, magicAction, magicPending] = useActionState(magicLinkAction, null)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <BoxReveal boxColor="var(--skeleton)" duration={0.3}>
        <h2 className="text-3xl font-bold text-foreground">Welcome back</h2>
      </BoxReveal>

      <BoxReveal boxColor="var(--skeleton)" duration={0.3} className="pb-2">
        <p className="text-sm text-muted-foreground">Sign in to your VroomX account</p>
      </BoxReveal>

      {inviteToken && (
        <BoxReveal boxColor="var(--skeleton)" duration={0.3} width="100%">
          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
            Sign in to accept your team invitation.
          </div>
        </BoxReveal>
      )}

      {error && (
        <BoxReveal boxColor="var(--skeleton)" duration={0.3} width="100%">
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        </BoxReveal>
      )}

      {/* Google login button (visual placeholder) */}
      <BoxReveal boxColor="var(--skeleton)" duration={0.3} overflow="visible" width="100%">
        <button
          className="g-button group/btn w-full rounded-md h-10 font-medium outline-hidden hover:cursor-pointer relative bg-transparent"
          type="button"
          onClick={() => console.log('Google login clicked')}
        >
          <span className="flex items-center justify-center w-full h-full gap-3 text-sm">
            <Image
              src="https://cdn1.iconfinder.com/data/icons/google-s-logo/150/Google_Icons-09-512.png"
              width={26}
              height={26}
              alt="Google"
            />
            Continue with Google
          </span>
          <BottomGradient />
        </button>
      </BoxReveal>

      <BoxReveal boxColor="var(--skeleton)" duration={0.3} width="100%">
        <div className="flex items-center gap-4">
          <hr className="flex-1 border-dashed border-border-subtle" />
          <p className="text-sm text-muted-foreground">or</p>
          <hr className="flex-1 border-dashed border-border-subtle" />
        </div>
      </BoxReveal>

      <BoxReveal boxColor="var(--skeleton)" duration={0.3} width="100%">
        <Tabs defaultValue="password" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="magic-link">Magic Link</TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            {state?.error && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {state.error}
              </div>
            )}
            <form action={formAction} className="space-y-4">
              {inviteToken && <input type="hidden" name="invite_token" value={inviteToken} />}

              <div className="space-y-2">
                <AnimatedLabel htmlFor="email">Email</AnimatedLabel>
                <AnimatedInput
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <AnimatedLabel htmlFor="password">Password</AnimatedLabel>
                <div className="relative">
                  <AnimatedInput
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              <button
                className="group/btn relative block w-full rounded-md h-10 font-medium text-white bg-gradient-to-br from-brand to-[#2a3a4f] shadow-md hover:shadow-lg transition-shadow outline-hidden hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={isPending}
              >
                {isPending ? 'Signing in...' : 'Sign in'} &rarr;
                <BottomGradient />
              </button>
            </form>
          </TabsContent>

          <TabsContent value="magic-link">
            <form action={magicAction} className="space-y-4">
              <div className="space-y-2">
                <AnimatedLabel htmlFor="magic-email">Email</AnimatedLabel>
                <AnimatedInput
                  id="magic-email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                />
              </div>

              {magicState?.error && (
                <p className="text-sm text-destructive">{magicState.error}</p>
              )}

              {magicState?.success && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                  {magicState.message}
                </div>
              )}

              <button
                className="group/btn relative block w-full rounded-md h-10 font-medium text-white bg-gradient-to-br from-brand to-[#2a3a4f] shadow-md hover:shadow-lg transition-shadow outline-hidden hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={magicPending}
              >
                {magicPending ? 'Sending...' : 'Send Magic Link'} &rarr;
                <BottomGradient />
              </button>
            </form>
          </TabsContent>
        </Tabs>
      </BoxReveal>

      <BoxReveal boxColor="var(--skeleton)" duration={0.3}>
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            href={inviteToken ? `/signup?invite_token=${inviteToken}` : '/signup'}
            className="font-medium text-brand hover:underline"
          >
            Sign up
          </Link>
        </p>
      </BoxReveal>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
