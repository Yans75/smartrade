import type { Depth, Quote } from "@/lib/market/market.server";
import type { TradingMode } from "@/lib/mock/types";
import type { StructureAnalysis } from "./analysis.server";

/**
 * Construit l'état de marché envoyé à Jev.
 *
 * Principe : l'état ne contient que des mesures, jamais de conclusion. Écrire
 * ici « configuration haussière » reviendrait à souffler la réponse au modèle
 * et à rendre ses probabilités inexploitables pour la calibration. Les
 * interprétations appartiennent aux critères des questions, pas à l'état.
 *
 * Deuxième principe : ce qu'on ne mesure pas n'apparaît pas. Pas de champ
 * sweep, CVD ou absorption tant qu'aucun détecteur ne les calcule — un champ
 * vide ou inventé dégraderait les réponses au lieu de les enrichir.
 */

export type SignalState = {
  instrument: {
    symbole: string;
    prix_actuel: number;
    variation_24h_pct: number;
    source_prix: Quote["provider"];
  };
  horizon: {
    mode: TradingMode;
    unite_de_reference: string;
    atr_reference: number;
    /** ATR en % du prix : rend la volatilité comparable d'un instrument à l'autre. */
    atr_pct_du_prix: number;
  };
  structure_par_unite_de_temps: {
    unite: string;
    tendance: string;
    structure: string;
    bos_confirme: boolean;
    /** Distance du prix à chaque niveau clé, en ATR de référence (signée). */
    niveaux_cles: number[];
    poi: number[];
    fvg_non_combles: { debut: number; fin: number; type: string; distance_en_atr: number }[];
    /** Écart entre le prix et la clôture de l'unité, en ATR. */
    position_dans_la_fourchette_pct: number;
  }[];
  carnet_ordres: {
    disponible: boolean;
    /** Positif = pression acheteuse. */
    imbalance_pct: number;
    source: "carnet réel (Binance/OKX, 100 niveaux)" | "proxy volumétrique (PAS de l'order flow)";
    fiabilite: "mesure directe" | "approximation : ne pas en faire un argument fort";
  };
};

/** Position du prix entre le plus bas et le plus haut structurel, en %. */
function rangePosition(price: number, low: number, high: number): number {
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return 50;
  return Math.round(((price - low) / (high - low)) * 100);
}

/** Distance signée en ATR : négatif = le niveau est sous le prix. */
function inAtr(level: number, price: number, atr: number): number {
  if (!Number.isFinite(atr) || atr <= 0) return 0;
  return Number(((level - price) / atr).toFixed(2));
}

export function buildSignalState(
  symbol: string,
  mode: TradingMode,
  quote: Quote,
  analyses: StructureAnalysis[],
  reference: StructureAnalysis,
  depth: Depth | null,
): SignalState {
  const price = quote.price;
  const atr = reference.atr;

  return {
    instrument: {
      symbole: symbol,
      prix_actuel: price,
      variation_24h_pct: quote.change_24h,
      source_prix: quote.provider,
    },
    horizon: {
      mode,
      unite_de_reference: reference.timeframe,
      atr_reference: atr,
      atr_pct_du_prix: price > 0 ? Number(((atr / price) * 100).toFixed(3)) : 0,
    },
    structure_par_unite_de_temps: analyses.map((a) => {
      const [low, high] = [a.key_levels[0] ?? price, a.key_levels[1] ?? price];
      return {
        unite: a.timeframe,
        tendance: a.trend,
        structure: a.structure,
        bos_confirme: a.bos_detected,
        niveaux_cles: a.key_levels,
        poi: a.poi_levels,
        // La distance en ATR est ce qui permet au modèle de juger si une zone
        // est atteignable : un FVG à 0.3 ATR et un FVG à 6 ATR n'ont pas du
        // tout la même valeur, et les prix bruts seuls ne le disent pas.
        fvg_non_combles: a.fvg_zones.map((z) => ({
          debut: z.start,
          fin: z.end,
          type: z.type,
          distance_en_atr: inAtr((z.start + z.end) / 2, price, atr),
        })),
        position_dans_la_fourchette_pct: rangePosition(price, low, high),
      };
    }),
    carnet_ordres: depth
      ? {
          disponible: true,
          imbalance_pct: depth.imbalance,
          source:
            depth.source === "binance"
              ? "carnet réel (Binance/OKX, 100 niveaux)"
              : "proxy volumétrique (PAS de l'order flow)",
          fiabilite:
            depth.source === "binance"
              ? "mesure directe"
              : "approximation : ne pas en faire un argument fort",
        }
      : {
          disponible: false,
          imbalance_pct: 0,
          source: "proxy volumétrique (PAS de l'order flow)",
          fiabilite: "approximation : ne pas en faire un argument fort",
        },
  };
}
