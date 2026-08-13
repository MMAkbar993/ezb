'use client'

// ---------------------------------------------------------------------------
// Session-wide role context. profiles.role is 'agent' | 'broker' | 'admin' —
// 'admin' is also what "owner" means in this app (see sql/role_access_control.sql).
// Populated once by whichever layout already verified the session
// (app/dashboard/layout.tsx or app/admin/layout.tsx) — no page should fetch
// role on its own; consume it via useRole() instead.
// ---------------------------------------------------------------------------

import { createContext, useContext } from 'react'

export type Role = 'agent' | 'broker' | 'admin'

export interface RoleState {
  role: Role
  loading: boolean
  isAdmin: boolean
  isBrokerOrAdmin: boolean
}

const defaultState: RoleState = { role: 'agent', loading: true, isAdmin: false, isBrokerOrAdmin: false }

export const RoleContext = createContext<RoleState>(defaultState)

export function useRole(): RoleState {
  return useContext(RoleContext)
}

export function deriveRoleState(role: Role | null, loading: boolean): RoleState {
  const r: Role = role || 'agent'
  return {
    role: r,
    loading,
    isAdmin: r === 'admin',
    isBrokerOrAdmin: r === 'broker' || r === 'admin',
  }
}
