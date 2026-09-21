/**
 * Client TypeSafe AI (moteur Jev) pour Cloudflare Workers.
 *
 * TypeSafe publie un SDK Python, inutilisable ici : un Worker est un isolat V8,
 * il n'exécute pas de Python. Ce fichier réimplémente le même contrat REST en
 * TypeScript sur `fetch`, à partir du schéma OpenAPI publié par l'API
 * (https://api.typesafe.ai/openapi.json), tel que le reflète le SDK 0.7.0.
 *
 * Différence fondamentale avec un LLM génératif : Jev ne produit ni texte libre
 * ni nombres. Il répond à des questions typées et renvoie des PROBABILITÉS
 * calibrées. Impossible, donc, qu'il hallucine un prix d'entrée ou un stop :
 * les niveaux sont calculés de façon déterministe ailleurs (build-signal.ts).
 */

const DEFAULT_BASE_URL = "https://api.typesafe.ai";
const SYSTEM_ONE_PATH = "/v1/systemone";
const MODELS_PATH = "/v1/models";

/** Contenu accepté par l'API pour un état ou une description de critère. */
export type JsonContent = string | Record<string, unknown> | unknown[];

/** Question oui/non. La réponse est une probabilité, pas un booléen. */
export type NoulQuestion = {
  type: "noul";
  instructions?: JsonContent;
  criteria?: { true?: JsonContent | null; false?: JsonContent | null };
};

/** Question à choix : un label est sélectionné parmi `criteria`. */
export type ChoiceQuestion = {
  type: "choice";
  instructions?: JsonContent;
  /** Label -> description de quand il s'applique (null = interprété par son nom). */
  criteria: Record<string, JsonContent | null>;
};

/** Question notée : la position dans `criteria` donne le score, à partir de 0. */
export type ScoreQuestion = {
  type: "score";
  instructions?: JsonContent;
  criteria: JsonContent[];
};

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export type NoulAnswer = {
  type: "noul";
  /** Probabilité du « oui », de 0 à 1. 0.5 = incertitude. */
  noul: number;
};

export type ChoiceAnswer = {
  type: "choice";
  /** Label le plus probable parmi les critères de la question. */
  choice: string;
  /** Confiance dans le label retenu, de 0 à 1. */
  confidence: number;
  /** Probabilité de chaque label ; la somme vaut ~1. */
  probabilities: Record<string, number>;
};

export type ScoreAnswer = {
  type: "score";
  /** Score espéré : moyenne des niveaux pondérée par leurs probabilités. Peut être fractionnaire. */
  score: number;
  confidence: number;
  legend: Record<string, JsonContent>;
  probabilities: Record<string, number>;
};

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export type SystemOneResponse = {
  model: string;
  answers: Record<string, Answer>;
  usage: { input_tokens: number; output_tokens: number };
};

export class JevError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = "JevError";
  }
}

/** Statuts que le SDK officiel considère comme réessayables. */
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

/** Messages en français pour les échecs que l'utilisateur peut voir passer. */
function messageFor(status: number, detail: string | null): string {
  if (status === 401) return "Clé API TypeSafe invalide ou manquante (TYPESAFE_API_KEY).";
  if (status === 403) return "L'accès à l'API TypeSafe est refusé (clé restreinte).";
  if (status === 404) return "Modèle Jev introuvable : vérifiez TYPESAFE_MODEL.";
  if (status === 422)
    return `Requête refusée par Jev : ${detail ?? "état ou questions invalides"}.`;
  if (status === 429)
    return "Trop de requêtes vers Jev en peu de temps. Réessayez dans quelques secondes.";
  if (status >= 500) return "Le service Jev est momentanément indisponible. Réessayez.";
  return detail ?? `L'appel à Jev a échoué (HTTP ${status}).`;
}

/**
 * Extrait le message d'erreur du corps, en suivant les formes que gère le SDK
 * officiel : `error`, `error.message`, `message`, `detail`.
 */
function extractDetail(body: unknown): string | null {
  if (typeof body === "string") return body.slice(0, 200) || null;
  if (body === null || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b["error"] === "string") return b["error"];
  if (b["error"] !== null && typeof b["error"] === "object") {
    const msg = (b["error"] as Record<string, unknown>)["message"];
    if (typeof msg === "string") return msg;
  }
  if (typeof b["message"] === "string") return b["message"];
  if (typeof b["detail"] === "string") return b["detail"];
  // 422 de FastAPI : detail est une liste d'erreurs de validation.
  if (Array.isArray(b["detail"])) {
    const first = b["detail"][0] as Record<string, unknown> | undefined;
    if (first && typeof first["msg"] === "string") {
      const loc = Array.isArray(first["loc"]) ? first["loc"].join(".") : "";
      return loc ? `${loc} — ${first["msg"]}` : first["msg"];
    }
  }
  return null;
}

export type SystemOneOptions = {
  state: JsonContent;
  questions: Record<string, Question>;
  model?: string;
  /** Plafond par tentative, en millisecondes. */
  timeoutMs?: number;
  /** Nombre de nouvelles tentatives après un échec réessayable. */
  maxRetries?: number;
};

/**
 * Appelle POST /v1/systemone.
 *
 * Le budget temps est par tentative : avec le défaut (8 s, 1 retry), le pire
 * cas reste sous 20 s même en comptant le backoff — c'est la contrainte de
 * latence de la plateforme qui dicte ces valeurs.
 */
export async function systemOne({
  state,
  questions,
  model,
  timeoutMs,
  maxRetries,
}: SystemOneOptions): Promise<SystemOneResponse> {
  const apiKey = process.env["TYPESAFE_API_KEY"];
  if (!apiKey) throw new JevError("Configuration manquante : TYPESAFE_API_KEY.", 401);

  if (Object.keys(questions).length === 0) {
    throw new JevError("Au moins une question est requise.", 400);
  }

  const baseUrl = (process.env["TYPESAFE_BASE_URL"] ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const body = JSON.stringify({
    state,
    model: model ?? JEV_MODEL,
    questions,
  });

  const perAttemptMs = timeoutMs ?? JEV_TIMEOUT_MS;
  const retries = maxRetries ?? JEV_MAX_RETRIES;

  let lastError: JevError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // Backoff court et borné : au-delà, on dépasse le budget de latence de
      // la plateforme et mieux vaut une erreur nette qu'une attente.
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${SYSTEM_ONE_PATH}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-TypeSafe-SDK": "smartrade-ts",
          ...(attempt > 0 ? { "X-TypeSafe-Retry-Count": String(attempt) } : {}),
        },
        body,
        signal: AbortSignal.timeout(perAttemptMs),
      });
    } catch (error) {
      const timedOut =
        error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      lastError = new JevError(
        timedOut
          ? `Jev n'a pas répondu en moins de ${Math.round(perAttemptMs / 1000)}s.`
          : `Connexion à Jev impossible : ${(error as Error).message}`,
        timedOut ? 504 : 503,
      );
      continue; // réseau et timeout sont toujours réessayables
    }

    const requestId = response.headers.get("x-typesafe-request-id");

    if (response.ok) {
      const decoded = (await response.json()) as unknown;
      return parseSystemOne(decoded, requestId);
    }

    const raw = await response.text();
    let parsedBody: unknown = raw;
    try {
      parsedBody = JSON.parse(raw) as unknown;
    } catch {
      /* corps non-JSON : on garde le texte */
    }
    lastError = new JevError(
      messageFor(response.status, extractDetail(parsedBody)),
      response.status,
      requestId,
    );

    if (!RETRYABLE.has(response.status)) throw lastError;
  }

  throw lastError ?? new JevError("L'appel à Jev a échoué.", 500);
}

/**
 * Valide la forme de la réponse. Les types d'answer inconnus sont ignorés
 * plutôt que de faire échouer tout l'appel : c'est le comportement du SDK
 * officiel, pour qu'une future extension de l'API ne casse pas ce client.
 */
function parseSystemOne(decoded: unknown, requestId: string | null): SystemOneResponse {
  if (decoded === null || typeof decoded !== "object") {
    throw new JevError("Réponse Jev illisible.", 502, requestId);
  }
  const d = decoded as Record<string, unknown>;
  const rawAnswers = d["answers"];
  if (rawAnswers === null || typeof rawAnswers !== "object") {
    throw new JevError("Réponse Jev sans answers.", 502, requestId);
  }

  const answers: Record<string, Answer> = {};
  for (const [name, value] of Object.entries(rawAnswers as Record<string, unknown>)) {
    if (value === null || typeof value !== "object") continue;
    const a = value as Record<string, unknown>;
    if (a["type"] === "noul" && typeof a["noul"] === "number") {
      answers[name] = { type: "noul", noul: a["noul"] };
    } else if (
      a["type"] === "choice" &&
      typeof a["choice"] === "string" &&
      typeof a["confidence"] === "number"
    ) {
      answers[name] = {
        type: "choice",
        choice: a["choice"],
        confidence: a["confidence"],
        probabilities: (a["probabilities"] as Record<string, number>) ?? {},
      };
    } else if (a["type"] === "score" && typeof a["score"] === "number") {
      answers[name] = {
        type: "score",
        score: a["score"],
        confidence: typeof a["confidence"] === "number" ? a["confidence"] : 0,
        legend: (a["legend"] as Record<string, JsonContent>) ?? {},
        probabilities: (a["probabilities"] as Record<string, number>) ?? {},
      };
    }
    // type inconnu : ignoré volontairement (compatibilité ascendante)
  }

  const usage = d["usage"] as Record<string, unknown> | undefined;
  return {
    model: typeof d["model"] === "string" ? d["model"] : JEV_MODEL,
    answers,
    usage: {
      input_tokens: typeof usage?.["input_tokens"] === "number" ? usage["input_tokens"] : 0,
      output_tokens: typeof usage?.["output_tokens"] === "number" ? usage["output_tokens"] : 0,
    },
  };
}

/**
 * GET /v1/models — liste les modèles accessibles à la clé.
 *
 * Sert de test de bout en bout : c'est l'appel le moins cher qui prouve à la
 * fois que la clé est valide et que l'alias configuré existe côté TypeSafe.
 */
export async function listModels(): Promise<
  { name: string; description: string; release_date: string }[]
> {
  const apiKey = process.env["TYPESAFE_API_KEY"];
  if (!apiKey) throw new JevError("Configuration manquante : TYPESAFE_API_KEY.", 401);
  const baseUrl = (process.env["TYPESAFE_BASE_URL"] ?? DEFAULT_BASE_URL).replace(/\/+$/, "");

  const response = await fetch(`${baseUrl}${MODELS_PATH}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new JevError(
      messageFor(response.status, extractDetail(await response.text())),
      response.status,
      response.headers.get("x-typesafe-request-id"),
    );
  }
  const decoded = (await response.json()) as { models?: unknown };
  return Array.isArray(decoded.models)
    ? (decoded.models as { name: string; description: string; release_date: string }[])
    : [];
}

/** Alias par défaut du modèle, conforme au SDK officiel. */
export const JEV_MODEL = process.env["TYPESAFE_MODEL"] ?? "jev-latest";

/**
 * 8 s par tentative. Jev est un modèle « System One » : pas de chaîne de
 * raisonnement, la réponse tient en quelques centaines de millisecondes en
 * temps normal. Le SDK officiel plafonne d'ailleurs à 10 s par défaut.
 */
export const JEV_TIMEOUT_MS = Number(process.env["TYPESAFE_TIMEOUT_MS"] ?? 8_000);

/** Une seule nouvelle tentative : deux échecs de suite ne sont pas un aléa. */
export const JEV_MAX_RETRIES = Number(process.env["TYPESAFE_MAX_RETRIES"] ?? 1);
