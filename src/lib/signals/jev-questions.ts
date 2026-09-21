import type { ChoiceQuestion, Question, ScoreQuestion } from "@/lib/jev/client.server";
import type { TradingMode } from "@/lib/mock/types";

/**
 * Les trois questions posées à Jev pour chaque signal.
 *
 * Règle de rédaction : chaque critère ne parle que de données réellement
 * présentes dans l'état envoyé (BOS, FVG, tendance SMA, ATR, imbalance du
 * carnet). Décrire un critère à partir d'un signal qu'on ne mesure pas — un
 * sweep de liquidité, un CVD, une absorption — produirait des probabilités
 * calibrées sur du vide.
 */

const MODE_HORIZON: Record<TradingMode, string> = {
  scalping: "quelques minutes à une heure, avec un risque serré",
  day_trading: "la séance en cours, clôture avant la fin de journée",
  swing: "plusieurs jours, tolérance aux mèches intermédiaires",
};

function direction(symbol: string, mode: TradingMode): ChoiceQuestion {
  return {
    type: "choice",
    instructions: {
      tache: `Déterminer le sens du trade à prendre sur ${symbol}`,
      horizon: MODE_HORIZON[mode],
      methode:
        "Raisonner en Smart Money Concepts : la structure de marché (BOS) et la tendance des moyennes mobiles priment sur l'imbalance du carnet, qui ne sert que de confirmation.",
    },
    criteria: {
      BUY: "La structure multi-timeframe est haussière sur l'unité de référence : BOS haussier confirmé, ou tendance haussière avec un FVG haussier non comblé sous le prix servant de zone de support. Un désaccord entre unités de temps est acceptable si l'unité de référence est nette.",
      SELL: "La structure multi-timeframe est baissière sur l'unité de référence : BOS baissier confirmé, ou tendance baissière avec un FVG baissier non comblé au-dessus du prix servant de zone de résistance.",
      NEUTRAL:
        "Aucune configuration exploitable : structure en range sur l'unité de référence, unités de temps en contradiction franche, ou prix au milieu de sa fourchette sans niveau proche. Choisir NEUTRAL plutôt que forcer un trade médiocre.",
    },
  };
}

function setupQuality(mode: TradingMode): ScoreQuestion {
  return {
    type: "score",
    instructions: {
      tache: "Noter la qualité du setup identifié, indépendamment de son sens",
      horizon: MODE_HORIZON[mode],
      precision:
        "Noter ce que montrent les données fournies, pas ce qu'on voudrait y voir. Un setup correct mais banal vaut 2, pas 3.",
    },
    // L'ordre fait le score : position 0 = score 0, etc.
    criteria: [
      "Aucun setup : structure en range sur toutes les unités de temps, ou unités de temps en contradiction directe. Ne pas trader.",
      "Setup faible : une seule unité de temps donne un signal, sans confirmation ailleurs, ou le prix est loin de tout niveau clé ou FVG.",
      "Setup correct : l'unité de référence est claire (BOS ou tendance nette) et au moins une autre unité va dans le même sens, mais il manque une confluence — pas de FVG utilisable, ou imbalance du carnet contraire.",
      "Setup solide : structure alignée sur plusieurs unités de temps, prix proche d'un niveau clé ou d'un FVG exploitable dans le sens du trade, imbalance du carnet neutre ou favorable.",
      "Setup exceptionnel : alignement complet des unités de temps, BOS confirmé sur l'unité de référence, FVG non comblé servant de zone d'entrée précise, et imbalance du carnet clairement dans le sens du trade. Rare — réserver aux cas sans réserve.",
    ],
  };
}

function entryTiming(mode: TradingMode): ChoiceQuestion {
  return {
    type: "choice",
    instructions: {
      tache: "Déterminer à quel moment entrer en position si un trade est pris",
      horizon: MODE_HORIZON[mode],
      note: "Cette réponse ne remet pas en cause la direction : elle dit seulement s'il faut payer le prix du marché maintenant ou attendre un meilleur point d'entrée.",
    },
    criteria: {
      immediate:
        "Entrer au prix du marché : le mouvement est en cours, le prix vient de casser un niveau structurel et s'en éloigne. Attendre coûterait plus que le gain d'un meilleur prix.",
      pullback:
        "Attendre un repli vers un niveau précis avant d'entrer : le prix est étendu par rapport à sa moyenne, mais un FVG non comblé ou un niveau clé se situe entre le prix actuel et le stop. L'entrée se fera sur ce retour.",
      wait: "Ne pas entrer maintenant : le prix est au milieu de sa fourchette, ou il vient de bouger violemment sans avoir formé de structure exploitable. Il faut une nouvelle confirmation.",
    },
  };
}

/** Les trois questions posées en un seul appel à Jev. */
export function signalQuestions(symbol: string, mode: TradingMode): Record<string, Question> {
  return {
    direction: direction(symbol, mode),
    setup_quality: setupQuality(mode),
    entry_timing: entryTiming(mode),
  };
}

/** Nombre de niveaux du barème `setup_quality`, pour convertir le score en %. */
export const SETUP_QUALITY_MAX = 4;
