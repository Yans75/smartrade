import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Paramètres supplémentaires fusionnés dans le corps de chaque requête, lus
 * depuis DEEPSEEK_EXTRA_BODY (JSON).
 *
 * Sert surtout à couper le mode "thinking" : deepseek-v4-pro raisonne par
 * défaut, ce qui fait passer une génération de ~15 s à plusieurs minutes. La
 * convention exacte du paramètre n'est pas vérifiable depuis cet environnement
 * (réseau bloqué vers la doc DeepSeek), donc elle est configurable plutôt que
 * codée en dur — on peut tester une convention sans redéployer, en changeant
 * seulement le secret.
 *
 * Exemples de valeurs à essayer :
 *   {"chat_template_kwargs":{"thinking":false}}
 *   {"thinking":{"type":"disabled"}}
 *   {"reasoning_effort":"minimal"}
 */
function extraBody(): Record<string, unknown> {
  const raw = process.env["DEEPSEEK_EXTRA_BODY"];
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    console.error("[DeepSeek] DEEPSEEK_EXTRA_BODY n'est pas du JSON valide, ignoré:", raw);
    return {};
  }
}

/** Injecte les paramètres additionnels dans le corps JSON sortant. */
function fetchWithExtraBody(extra: Record<string, unknown>): typeof fetch {
  if (Object.keys(extra).length === 0) return fetch;
  return async (input, init) => {
    if (typeof init?.body !== "string") return fetch(input, init);
    try {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      return fetch(input, { ...init, body: JSON.stringify({ ...body, ...extra }) });
    } catch {
      return fetch(input, init);
    }
  };
}

/**
 * L'API DeepSeek est compatible OpenAI, d'où le même client
 * @ai-sdk/openai-compatible.
 *
 * Base URL confirmée sur la page officielle "Models & Pricing" de DeepSeek :
 * "https://api.deepseek.com", sans suffixe /v1.
 *
 * supportsStructuredOutputs reste à false : à true, le SDK envoie le mode
 * strict json_schema d'OpenAI, refusé en production par DeepSeek. De toute
 * façon le parsing du JSON est fait à la main (voir extract-json.ts), donc
 * plus aucune négociation de format n'a lieu.
 */
export function createDeepSeekProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "deepseek",
    baseURL: "https://api.deepseek.com",
    supportsStructuredOutputs: false,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    fetch: fetchWithExtraBody(extraBody()),
  });
}

/**
 * "deepseek-v4-pro" par défaut — id confirmé sur la page Models & Pricing.
 * "deepseek-v4-flash" est nettement plus rapide et 3x moins cher : c'est la
 * première chose à essayer si la latence pose problème (changer le secret
 * DEEPSEEK_MODEL, aucun redéploiement de code nécessaire).
 */
export const SIGNAL_MODEL = process.env["DEEPSEEK_MODEL"] ?? "deepseek-v4-pro";

/** Plafond de temps sur l'appel au modèle, en millisecondes. */
export const SIGNAL_TIMEOUT_MS = Number(process.env["DEEPSEEK_TIMEOUT_MS"] ?? 60_000);

/**
 * Budget de tokens de sortie. En mode thinking, le raisonnement se consomme
 * sur ce budget : trop bas, le modèle raisonne jusqu'à épuisement et renvoie
 * un contenu vide. Une fois le thinking coupé (DEEPSEEK_EXTRA_BODY), 800
 * suffisent largement pour le signal seul.
 */
export const SIGNAL_MAX_TOKENS = Number(process.env["DEEPSEEK_MAX_TOKENS"] ?? 4_000);
