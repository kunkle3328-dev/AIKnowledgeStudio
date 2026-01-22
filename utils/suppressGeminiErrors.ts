/**
 * 🔒 SYSTEM INSTRUCTION — AUDIO SAFETY CONTRACT
 * Authority: This file is the hard boundary between Gemini API and User UI.
 * Rules: Gemini errors MUST NOT propagate. Silence is a valid state.
 */

export const GEMINI_IS_NON_BLOCKING = true;

/**
 * 🛡️ HARD GEMINI ERROR SUPPRESSOR
 * Wraps a promise and converts Gemini-specific failures (quota, 429, platform errors) into a null result.
 * This prevents the platform from catching the error and displaying a toast.
 */
export async function suppressGeminiErrors<T>(
  promise: Promise<T>
): Promise<T | null> {
  // Required companion rule: Force failure if requested by testing environment
  if ((window as any).__FORCE_GEMINI_QUOTA_ERROR__) {
    console.warn("[AXIOM TEST] Forcing Gemini Quota Error Suppression");
    return null;
  }

  if (!GEMINI_IS_NON_BLOCKING) return promise;

  try {
    return await promise;
  } catch (err: any) {
    const msg = (err?.message || err?.toString() || "").toLowerCase();
    
    // Explicit matching for the exact strings found in platform toasts to intercept them
    const isGeminiError = 
      msg.includes("gemini") || 
      msg.includes("quota") || 
      msg.includes("failed to call") ||
      msg.includes("429") ||
      msg.includes("limit") ||
      msg.includes("user has exceeded") ||
      msg.includes("api") ||
      msg.includes("network");

    if (isGeminiError) {
      // 🔕 SILENT SINK: Ownership transfers here. Returns null to signal fallback path.
      console.warn("[AXIOM GEMINI SUPPRESSED]", err?.message || err);
      return null; 
    }

    // Non-Gemini errors (code bugs) still throw for visibility in development
    throw err;
  }
}
