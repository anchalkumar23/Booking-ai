import { FeaturePanel } from "@/components/feature-panel"
import { SignInForm } from "@/components/sign-in-form"

export default function Page() {
  return (
    <main className="grid min-h-svh grid-cols-1 bg-background lg:grid-cols-2">
      <FeaturePanel />
      <SignInForm />
    </main>
  )
}
