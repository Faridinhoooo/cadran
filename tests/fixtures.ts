// Données de TEST uniquement : elles ne sont jamais écrites dans data/catalog.db.
import type { CandidateModel, OfferLite, ConfigLite } from "../src/lib/engine";
import type { SupportRow } from "../src/lib/support";

export const TODAY = new Date("2026-11-24T12:00:00Z");

export function offer(p: Partial<OfferLite> & { id: string; price: number }): OfferLite {
  return {
    condition: "neuf", seller: "Vendeur test", platform: null, mandatory_fees: 0, shipping: 0, available: true,
    checked_at: "2026-11-23T08:00:00Z", url: "https://example.test/offre", grade: null, battery_note: null, warranty: null,
    returns_policy: null, ...p,
  };
}

export function support(p: Partial<SupportRow> = {}): SupportRow {
  return {
    os_launch: null, os_latest_verified: null, upgrade_commitment: null, upgrade_count: null, upgrades_delivered: null,
    upgrade_end: null, upgrade_end_precision: null, security_years: null, security_end: null, security_end_precision: null,
    security_end_confirmed: 0, security_frequency: null, source_name: "test", source_url: null, policy_url: null, checked_at: null, ...p,
  };
}

export function model(p: Partial<CandidateModel> & { id: string; configs: ConfigLite[] }): CandidateModel {
  return {
    name: p.id, brand_id: "test", brand_name: "Test", os: "android", form_factor: "classique", image: null,
    specs: {}, measured: {}, support: null, ...p,
  };
}

export const phoneA = model({
  id: "phone-a", name: "Phone A", brand_id: "alpha",
  specs: { optical_zoom: 3, ois: true, cameras: "50 Mpx principal, 12 Mpx ultra grand-angle", chip_tier: 4, width_mm: 71, weight_g: 170, battery_mah: 4000, screen_in: 6.1, esim: true, refresh_hz: 120, ram_gb: 8 },
  support: support({ security_end: "2031-03-15", security_end_precision: "jour" }),
  configs: [
    { id: "phone-a-128", storage_gb: 128, ram_gb: 8, offers: [offer({ id: "a128", price: 380 })] },
    { id: "phone-a-256", storage_gb: 256, ram_gb: 8, offers: [offer({ id: "a256", price: 450 })] },
  ],
});

export const phoneB = model({
  id: "phone-b", name: "Phone B", brand_id: "beta",
  specs: { optical_zoom: 1, ois: false, cameras: "50 Mpx principal", chip_tier: 2, width_mm: 77, weight_g: 205, battery_mah: 6000, screen_in: 6.7, esim: null, refresh_hz: 90, ram_gb: 6 },
  support: support({ security_end: "2029-01-01", security_end_precision: "jour" }),
  configs: [{ id: "phone-b-128", storage_gb: 128, ram_gb: 6, offers: [offer({ id: "b128", price: 250 })] }],
});
