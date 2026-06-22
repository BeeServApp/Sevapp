import { getCurrentUser } from "@/lib/session"
import { getMyProfile } from "@/app/actions/staff"
import { getMyAvailability } from "@/app/actions/scheduling"
import { ROTA_DAYS } from "@/lib/rota"
import { MeView } from "@/components/portal/me-view"

export default async function PortalMePage() {
  const me = await getCurrentUser()
  const [profile, availability] = await Promise.all([getMyProfile(), getMyAvailability()])

  return (
    <MeView
      name={me.name}
      email={me.email}
      role={profile?.role ?? null}
      venueId={profile?.venueId ?? 0}
      staffMemberId={me.staffMemberId}
      rotaDays={[...ROTA_DAYS]}
      initialAvailability={availability}
    />
  )
}
