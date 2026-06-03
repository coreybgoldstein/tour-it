export function isMayActive(): boolean {
  const now = new Date();
  return now.getMonth() === 4 && now.getFullYear() === 2026;
}

// June 2026 — Wilson Golf-sponsored prize pack.
export function isJuneActive(): boolean {
  const now = new Date();
  return now.getMonth() === 5 && now.getFullYear() === 2026;
}

// Wilson Golf shop — destination for the "Powered by Wilson" sponsor pills.
export const WILSON_SHOP_URL =
  "https://www.wilson.com/en-us/golf?ef_id=Cj0KCQjwof_QBhCgARIsADaMzOf_-N8-_3Rysk1dj_TYZsAf1kN3UQw-VnxAJHIPC_Quubptvkw54bwaAo7wEALw_wcB:G&s_kwcid=AL!15981!3&utm_campaign=OG_SEM_BRAND_GOOG_TEXT_KWD_BTG_GOLF_CORE&utm_source=g&utm_medium=ps%7Ctxt%7Csb&cmpid=ps%7Ctxt%7Csb%7Cg%7COG_SEM_BRAND_GOOG_TEXT_KWD_BTG_GOLF_CORE&gad_source=1&gad_campaignid=23574415900&gbraid=0AAAAADcc_XDFmQbu-C-rwmFn6CzbIkCYG&gclid=Cj0KCQjwof_QBhCgARIsADaMzOf_-N8-_3Rysk1dj_TYZsAf1kN3UQw-VnxAJHIPC_Quubptvkw54bwaAo7wEALw_wcB";

// Wilson competition imagery (Supabase Storage; repo gitignores *.png).
export const WILSON_ASSET_BASE =
  "https://awlbxzpevwidowxxvuef.supabase.co/storage/v1/object/public/tour-it-photos/competitions/wilson";
