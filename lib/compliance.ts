import { supabase } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// State compliance & license checks for the Concord Deal Platform.
//
// Advisory tooling: flags whether an agent holds a real-estate license and
// whether they may list a deal that includes real property. This is NOT legal
// advice — confirm requirements with counsel / the relevant state commission.
// ---------------------------------------------------------------------------

export type LicenseStatus = 'unverified' | 'pending' | 'verified' | 'not_required' | 'expired'

export interface ProfileLicense {
  real_estate_license_number: string | null
  real_estate_license_state: string | null
  license_status: LicenseStatus
  is_license_verified: boolean
}

export interface LicenseCheck {
  ok: boolean
  licensed: boolean
  verified: boolean
  licenseNumber: string | null
  licenseState: string | null
  status: LicenseStatus
  reason: string
}

export interface RealEstateListingCheck {
  canList: boolean
  reason: string
}

// States where brokering a business that transfers real property commonly
// requires an active real-estate license. Conservative advisory default:
// treat all as requiring it (many states do for real-property-inclusive deals).
const LICENSED_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
])

// ---------------------------------------------------------------------------
// Load the current user's license fields from their profile.
// ---------------------------------------------------------------------------
export async function getMyLicense(): Promise<ProfileLicense | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('real_estate_license_number, real_estate_license_state, license_status, is_license_verified')
    .eq('id', user.id)
    .maybeSingle()

  if (!data) return null
  return {
    real_estate_license_number: data.real_estate_license_number ?? null,
    real_estate_license_state: data.real_estate_license_state ?? null,
    license_status: (data.license_status as LicenseStatus) ?? 'unverified',
    is_license_verified: data.is_license_verified ?? false,
  }
}

export async function getLicenseFor(userId: string): Promise<ProfileLicense | null> {
  const { data } = await supabase
    .from('profiles')
    .select('real_estate_license_number, real_estate_license_state, license_status, is_license_verified')
    .eq('id', userId)
    .maybeSingle()

  if (!data) return null
  return {
    real_estate_license_number: data.real_estate_license_number ?? null,
    real_estate_license_state: data.real_estate_license_state ?? null,
    license_status: (data.license_status as LicenseStatus) ?? 'unverified',
    is_license_verified: data.is_license_verified ?? false,
  }
}

// ---------------------------------------------------------------------------
// checkAgentLicense — does this agent hold a compliant license?
// ---------------------------------------------------------------------------
export async function checkAgentLicense(userId?: string): Promise<LicenseCheck> {
  const profile = userId ? await getLicenseFor(userId) : await getMyLicense()
  if (!profile) {
    return {
      ok: false,
      licensed: false,
      verified: false,
      licenseNumber: null,
      licenseState: null,
      status: 'unverified',
      reason: 'No license information on file. Add your real-estate license to proceed with real-estate listings.',
    }
  }

  const licensed = !!profile.real_estate_license_number && !!profile.real_estate_license_state
  const verified = profile.is_license_verified === true && profile.license_status === 'verified'
  const expired = profile.license_status === 'expired'

  let reason = ''
  if (expired) reason = 'Your real-estate license is expired.'
  else if (!licensed) reason = 'No real-estate license on file for this broker.'
  else if (!verified) reason = 'License on file but not yet verified.'

  return {
    ok: !!licensed && !!verified && !expired,
    licensed,
    verified,
    licenseNumber: profile.real_estate_license_number,
    licenseState: profile.real_estate_license_state,
    status: profile.license_status,
    reason,
  }
}

// ---------------------------------------------------------------------------
// canListWithRealEstate — may this agent list a deal that includes property?
// ---------------------------------------------------------------------------
export async function canListWithRealEstate(
  userId?: string,
  targetState?: string | null,
): Promise<RealEstateListingCheck> {
  const license = await checkAgentLicense(userId)

  if (!license.ok) {
    return {
      canList: false,
      reason: license.reason || 'Agent is not verified to broker real-estate-inclusive deals.',
    }
  }

  // If a target state is specified, the license must cover it (or be a
  // reciprocity-eligible state). Conservative: require a matching state.
  if (targetState) {
    const norm = targetState.trim().toUpperCase()
    if (license.licenseState && license.licenseState.toUpperCase() !== norm) {
      return {
        canList: false,
        reason: `License is held in ${license.licenseState.toUpperCase()}, not ${norm}. Confirm reciprocity or licensure in ${norm} before listing real estate here.`,
      }
    }
  }

  return { canList: true, reason: 'Agent is licensed and verified for this real-estate listing.' }
}

export { LICENSED_STATES }
