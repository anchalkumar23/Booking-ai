"use client"

import type React from "react"
import { useState } from "react"
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

export function SignInForm() {
  const [showPassword, setShowPassword] = useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }

  return (
    <section className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto w-full max-w-md">
        {/* Mobile brand */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="font-serif text-lg font-semibold leading-none">B</span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">Booking AI</p>
            <p className="text-xs text-muted-foreground">Automation Platform</p>
          </div>
        </div>

        <h2 className="font-serif text-4xl tracking-tight text-foreground">
          Welcome back
        </h2>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Sign in to your admin dashboard to manage your automation platform.
        </p>

        <form onSubmit={handleSubmit} className="mt-9 space-y-5">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold text-foreground">
              Email address
            </Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@bookingai.com"
                className="h-12 rounded-xl pl-10"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                Password
              </Label>
              <a
                href="#"
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="h-12 rounded-xl px-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>

          {/* Keep signed in */}
          <div className="flex items-center gap-2.5">
            <Checkbox id="keep-signed-in" />
            <Label
              htmlFor="keep-signed-in"
              className="text-sm font-normal text-muted-foreground"
            >
              Keep me signed in
            </Label>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="group h-12 w-full rounded-xl text-sm font-semibold"
          >
            Sign in to dashboard
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          </Button>
        </form>

        {/* Divider */}
        <div className="my-7 flex items-center gap-4">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* Status */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3.5 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-foreground">
              All systems operational
            </span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Secured with 256-bit encryption · Booking AI © 2026
        </p>
      </div>
    </section>
  )
}
