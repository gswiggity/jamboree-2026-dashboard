import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams
  const decoded = message
    ? decodeURIComponent(message)
    : "Something went wrong during sign-in."

  const isNotAllowlisted = decoded.toLowerCase().includes("allowlist")

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Sign-in failed
          </h1>
          <p className="text-sm text-muted-foreground">
            {isNotAllowlisted
              ? "Your email isn't on the invite list. Ask a Jamboree admin to add you."
              : decoded}
          </p>
        </div>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Back to login
        </Link>
      </div>
    </main>
  )
}
