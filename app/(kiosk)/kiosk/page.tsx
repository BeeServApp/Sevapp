import { getKioskState } from "@/app/actions/kiosk"
import { KioskRoot } from "@/components/kiosk/kiosk-root"

// The kiosk is always dynamic — it reads the device cookie on every request.
export const dynamic = "force-dynamic"

export default async function KioskPage() {
  const state = await getKioskState()
  return <KioskRoot initialState={state} />
}
