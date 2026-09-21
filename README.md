# Smartrade

Plateforme SaaS de signaux de trading, indépendante — pas de plateforme
tierce, pas de fournisseur imposé. L'application lit la structure de marché
(ICT / Smart Money Concepts) sur quatre unités de temps à partir de vraies
bougies, y ajoute le carnet d'ordres quand il existe, puis soumet cette
lecture au moteur de décision Jev (TypeSafe AI). Jev tranche — sens, qualité
du setup, moment d'entrée — et le code calcule les niveaux depuis l'ATR :
entrée, stop loss, trois take profits.

Le modèle ne manipule aucun prix, donc il ne peut en inventer aucun.

Marchés couverts : crypto, forex, matières premières, indices — 36
instruments. Modèle économique : 3 signaux offerts par jour, abonnement Pro à
29 €/mois (le paiement Stripe n'est pas branché, le bouton est en démo).

---

## Stack

| Couche | Technologie |
| --- | --- |
| Framework | TanStack Start (SSR) + React 19 + Vite |
| Routage | TanStack Router (routes fichiers dans `src/routes`) |
| UI | Tailwind CSS v4, shadcn/ui, Recharts, Lucide |
| Données & auth | Supabase — votre propre projet, RLS par utilisateur |
| Moteur de décision | TypeSafe AI (Jev), client REST maison — aucun SDK |
| Données de marché | Binance → OKX → Bybit (crypto), Yahoo Finance et Twelve Data (reste), gold-api (spot métaux) |
| Runtime | Bun |
| Déploiement cible | Cloudflare Workers (build Nitro déjà configuré, preset `cloudflare-module`) |

Aucune dépendance à une plateforme tierce : le code, la base de données et le
fournisseur IA sont chacun sous votre propre compte.

---

## Comment un signal est fabriqué

`generateSignal` (`src/lib/signals/signals.functions.ts`) orchestre cinq
étapes.

**1. Quota, côté serveur**
3 signaux par jour + `bonus_signals` pour un compte free, illimité en
premium. Le compteur vit dans `signal_usage`, clé `(user_id, usage_date)`.
Rien n'est décidé côté client.

**2. Collecte des données** — `src/lib/market/market.server.ts`
150 bougies sur 15m, 1h, 4h et 1d, le prix courant et le carnet d'ordres, en
parallèle. Chaque source a un repli : Binance bascule sur OKX puis Bybit
quand elle est géo-bloquée, Yahoo bascule sur Twelve Data. Les cours sont mis
en cache 2 s (crypto) à 6 s (reste) pour tenir la limite de 8 requêtes/minute
du plan gratuit Twelve Data.

**3. Analyse technique, sans IA** — `src/lib/signals/analysis.server.ts`
Calcul déterministe, en TypeScript, sur chaque unité de temps : pivots
hauts/bas, Break of Structure, tendance (BOS + SMA20 vs SMA50), Fair Value
Gaps (imbalance à trois bougies), ATR 14, niveaux clés.

**4. Décision par le moteur Jev** — `src/lib/signals/signals.server.ts`
Le modèle ne voit pas les bougies : `jev-state.ts` lui soumet un état
structuré — prix, ATR, structure des quatre unités de temps, distance de
chaque FVG en ATR, imbalance du carnet. L'état ne contient que des mesures,
jamais de conclusion : souffler la réponse au modèle rendrait ses
probabilités inexploitables pour la calibration.

`jev-questions.ts` pose trois questions typées en un seul appel :

| Question | Type | Réponse |
|---|---|---|
| `direction` | choice | BUY / SELL / NEUTRAL + probabilité de chacun |
| `setup_quality` | score | note 0–4 sur un barème explicite + confiance |
| `entry_timing` | choice | immediate / pullback / wait |

**5. Construction du signal** — `src/lib/signals/build-signal.ts`
Jev décide, le code calcule. Aucun prix ne transite par le modèle, donc
aucun prix ne peut être halluciné — c'est l'inverse de l'approche LLM
génératif, où chaque niveau sortait du texte et devait être rattrapé après
coup.

Garde-fous appliqués à la sortie de Jev :

- qualité de setup sous 1,5/4 → `NEUTRAL` forcé ;
- sens retenu sous 45 % de probabilité → `NEUTRAL` (c'est un pile ou face) ;
- `entry_timing = wait` → `NEUTRAL` ;
- `pullback` → l'entrée se pose sur le bord du FVG le plus proche allant
  dans le sens du trade, entre 0,2 et 1,5 ATR ; sans candidat, entrée au
  prix courant plutôt qu'à un niveau que le marché n'atteindra pas.

Les niveaux viennent de `validate.ts` (`buildLevels`) : stop à 0,8 / 1,2 /
1,8 ATR selon l'horizon, take profits en 1,2R / 2R / 3R. `checkLevels` reste
en filet pour les ATR dégénérés sur instruments peu liquides. La confiance
affichée est `probabilité du sens × (0,5 + 0,5 × qualité/4)`.

**6. Journalisation** — `src/lib/signals/jev-log.server.ts`
Chaque appel est archivé dans `jev_calls` avec l'état exact soumis, les
questions exactes posées, les réponses brutes, la décision après garde-fous,
la latence et les tokens. Sans l'état d'origine un backtest ne peut pas
rejouer la décision ; sans les questions d'origine, une reformulation
ultérieure rendrait les anciennes réponses incomparables. Une écriture de
journal ne peut jamais faire échouer une génération : toute erreur est avalée
et tracée.

Le signal est ensuite écrit dans `signals` et le quota incrémenté.

### Le moteur de décision : Jev (TypeSafe AI)

`src/lib/jev/client.server.ts` appelle `POST https://api.typesafe.ai/v1/systemone`.

TypeSafe publie un SDK Python ; il est inutilisable ici, un Cloudflare Worker
étant un isolat V8 qui n'exécute pas de Python. Le client est donc une
réimplémentation TypeScript du même contrat REST sur `fetch`, écrite d'après
le schéma OpenAPI publié par l'API (`https://api.typesafe.ai/openapi.json`)
tel que le reflète le SDK 0.7.0.

Jev est un modèle *System One* : il ne déroule aucune chaîne de raisonnement
et renvoie des probabilités calibrées plutôt que du texte. C'est ce qui rend
le budget de latence tenable — et ce qui garantit qu'il ne peut pas inventer
un niveau de prix.

Variables d'environnement (seule la première est obligatoire) :

| Variable | Défaut | Rôle |
|---|---|---|
| `TYPESAFE_API_KEY` | — | clé API, depuis typesafe.ai |
| `TYPESAFE_MODEL` | `jev-latest` | alias du modèle ; `GET /v1/models` liste les valides |
| `TYPESAFE_TIMEOUT_MS` | `8000` | plafond par tentative |
| `TYPESAFE_MAX_RETRIES` | `1` | nouvelles tentatives sur 408 / 429 / 5xx |
| `TYPESAFE_BASE_URL` | `https://api.typesafe.ai` | à ne changer que pour un mock |

Les erreurs non réessayables (401, 403, 404, 422) remontent immédiatement,
traduites en français et sans nouvelle tentative. `listModels()` sert de test
de bout en bout : c'est l'appel le moins cher qui prouve à la fois que la clé
est valide et que l'alias configuré existe.

Sans `TYPESAFE_API_KEY`, la génération échoue avec un message explicite
plutôt que d'appeler l'API sans authentification.

---

## Suivi automatique des positions

`src/lib/signals/tracking.server.ts` rejoue le marché sur chaque signal
ouvert : les bougies imprimées depuis l'émission (15m en scalping et day
trading, 1h en swing) sont parcourues dans l'ordre pour détecter les touches
de stop et de take profit.

Règles :

- le stop l'emporte quand les deux côtés sont touchés dans la même bougie —
  l'ordre intra-bougie est inconnu sur des données OHLC, et surestimer un
  track record public serait la pire des erreurs ;
- un take profit encaissé lors d'une bougie antérieure serait déjà pris : le
  trade est alors clôturé à ce take profit, pas au stop ;
- TP3 clôture la position ;
- un signal non résolu au-delà de 6 h (scalping), 36 h (day trading) ou 10
  jours (swing) est clôturé au prix du marché avec le statut `cancelled`.

La synchronisation tourne à chaque chargement de l'historique ou des
statistiques, throttlée à une passe par utilisateur et par minute. Le bouton
« Vérifier TP / SL » de la page Historique force une passe immédiate.

---

## Order flow : ce qui est réel et ce qui ne l'est pas

En crypto, le carnet est réel : 100 niveaux Binance ou OKX, agrégés en 14
paliers cumulés. Sur le forex, les matières premières et les indices, il
n'existe pas de carnet public : la courbe affichée est un proxy reconstruit
à partir de la distribution des volumes des 40 dernières bougies 15m,
étiqueté « estimé » dans l'interface, et l'état soumis à Jev porte un champ
`fiabilite` explicite pour qu'il n'en fasse pas un argument fort.

---

## Structure du code

```
src/
├── routes/                 # pages (TanStack Router)
├── components/             # UI : SignalCard, DepthChart, TimeframePanel…
├── lib/
│   ├── jev/client.server.ts    # client TypeSafe AI (REST, sans SDK)
│   ├── market/                 # sources de marché, symboles, cache
│   ├── signals/
│   │   ├── analysis.server.ts  # ICT/SMC déterministe
│   │   ├── signals.server.ts   # orchestration du pipeline
│   │   ├── jev-state.ts        # état de marché soumis à Jev
│   │   ├── jev-questions.ts    # les 3 questions de décision
│   │   ├── build-signal.ts     # décision → signal, niveaux sur ATR
│   │   ├── jev-log.server.ts   # journal des appels (backtest, calibration)
│   │   ├── validate.ts         # géométrie des niveaux + garde-fou
│   │   ├── tracking.server.ts  # résolution TP / SL
│   │   ├── signals.functions.ts# server functions (quota, persistance, sync)
│   │   ├── derive.ts           # statistiques détaillées
│   │   └── export.ts           # export CSV
│   └── admin/                  # gestion des utilisateurs
└── integrations/supabase/  # client, auth, types générés
supabase/migrations/        # schéma + RLS
```

Convention : un fichier `*.server.ts` ne part jamais dans le bundle client ;
les `*.functions.ts` en font partie, donc ils importent le code serveur en
dynamique.

---

## Base de données

| Table | Rôle |
| --- | --- |
| `profiles` | tier d'abonnement, signaux bonus |
| `user_roles` | rôle admin, lu via `has_role` non exécutable par les clients |
| `signals` | signaux, analyse multi-timeframe, statut, PnL |
| `signal_usage` | compteur quotidien par utilisateur |

RLS activée partout : chaque utilisateur ne voit et ne modifie que ses
lignes. Le schéma complet est dans `supabase/migrations/`.

---

## Mise en route

**Guide complet pas à pas : [SETUP.md](SETUP.md)** — création du projet
Supabase, schéma SQL en un copier-coller, clés, configuration de l'auth,
droits admin et déploiement, avec les pièges courants.

En résumé :

```bash
cp .env.example .env    # puis remplir les clés Supabase + TypeSafe
bun install
bun run dev             # http://localhost:8080
bun run lint
bun run build
```

Le schéma de base de données s'applique en une fois depuis
[`supabase/schema.sql`](supabase/schema.sql) (SQL Editor du dashboard
Supabase). Le dossier `supabase/migrations/` ne garde que l'historique.

Le build cible Cloudflare Workers (`nitro({ preset: "cloudflare-module" })`
dans `vite.config.ts`) : `bun run build && npx wrangler deploy --prebuilt`,
avec les mêmes variables d'environnement côté Worker.

---

## Reste à faire

- Paiement Stripe (bouton Pro en démo)
- Calibrer les seuils de décision sur les premières lignes de `jev_calls`
  structuré (`Output.object`) contre l'API réelle
- Notifications Telegram et email
- Basculer la synchronisation des positions en tâche de fond planifiée
- News et calendrier économique
- Déploiement initial et premier lien public

---

Le trading comporte un risque de perte en capital. Les signaux produits par
cette application sont une aide à la décision, pas un conseil en
investissement.
