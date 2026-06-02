import { create } from 'zustand';

// ── SECURITY NOTE ─────────────────────────────────────────────────────────────
// This store is for DISPLAY-ONLY admin simulation (UI preview).
// It does NOT persist to localStorage — simulation state resets on page reload.
// Feature access enforcement is done in useLicenseStore.canAccess() which reads
// the cryptographically-validated license tier from the main process.
// Simulation is intentionally limited to admin-facing UI for UX testing only.
// ─────────────────────────────────────────────────────────────────────────────

export const useSubscriptionStore = create(
  (set, get) => ({
    simulatedTier: null, // null means use active license tier (UI preview only)
    // NOTE: activeAddons removed — add-on "activation" must go through a real
    // license key issued by the vendor, not a free client-side toggle.

    setSimulatedTier: (tier) => set({ simulatedTier: tier }),
    resetSimulation: () => set({ simulatedTier: null }),
  })
);
