/**
 * Extrait le premier objet JSON complet d'un texte de modèle.
 *
 * Nécessaire parce que deepseek-v4-pro tourne en mode "thinking" par défaut :
 * la réponse peut contenir du raisonnement avant et/ou après le JSON, et
 * parfois des barrières markdown. Un JSON.parse direct échoue dans tous ces
 * cas, ce qui se traduisait par un NoObjectGeneratedError côté SDK sans
 * aucune information exploitable.
 *
 * Le balayage respecte les chaînes de caractères et les échappements, sinon
 * une accolade à l'intérieur d'un texte français ("prise de position {...}")
 * fausserait le comptage.
 */
export function extractJsonObject(raw: string): unknown {
  const text = stripCodeFences(raw);
  const start = text.indexOf("{");
  if (start === -1) throw new Error("Aucun objet JSON trouvé dans la réponse du modèle.");

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i]!;

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(text.slice(start, i + 1));
      }
    }
  }

  throw new Error("Objet JSON incomplet dans la réponse du modèle.");
}

/** Retire les barrières markdown ```json ... ``` si le modèle en ajoute. */
function stripCodeFences(text: string): string {
  return text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
}
