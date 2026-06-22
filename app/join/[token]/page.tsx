import { getInviteByToken } from "@/app/actions/invites"
import { JoinForm } from "@/components/join-form"
import { BrandLogo } from "@/components/brand-logo"
import { Card } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await getInviteByToken(token)

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandLogo className="h-16" priority />
        </div>

        {invite.valid ? (
          <JoinForm
            token={token}
            staffName={invite.staffName ?? ""}
            roleLabel={invite.roleLabel ?? "Team member"}
            venueName={invite.venueName ?? invite.companyName ?? "your venue"}
            presetEmail={invite.email ?? ""}
          />
        ) : (
          <Card className="p-6 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="size-6" />
            </div>
            <h1 className="font-heading text-xl font-semibold text-foreground">Invite unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {invite.reason === "expired"
                ? "This invite link has expired. Ask your manager to send a new one."
                : invite.reason === "used"
                  ? "This invite has already been used. Try signing in instead."
                  : "We couldn't find this invite. Check the link or ask your manager to resend it."}
            </p>
            <a
              href="/sign-in"
              className="mt-4 inline-block text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              Go to sign in
            </a>
          </Card>
        )}
      </div>
    </main>
  )
}
