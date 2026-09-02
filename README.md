# Smartrade

Plateforme SaaS de signaux de trading, indépendante — pas de plateforme
tierce, pas de fournisseur imposé. L'application lit la structure de marché
(ICT / Smart Money Concepts) sur quatre unités de temps à partir de vraies
bougies, y ajoute le carnet d'ordres quand il existe, puis demande à un LLM de
transformer cette lecture en signal exploitable : direction, entrée, stop
loss, trois take profits et le raisonnement en français.

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
| Appel LLM | Vercel AI SDK (`@ai-sdk/openai-compatible`) directement vers l'API DeepSeek |
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

**4. Appel au LLM** — `src/lib/signals/signals.server.ts`
Le modèle ne voit pas les bougies : il reçoit le résumé structurel des
quatre unités de temps, le prix, l'ATR de référence et l'imbalance du
carnet. Il rend un objet validé par un schéma Zod. Le calcul est
algorithmique, le LLM fait l'interprétation, le placement des niveaux et la
rédaction.

**5. Garde-fou déterministe** — `src/lib/signals/validate.ts`
La sortie du modèle est revalidée avant d'atteindre l'utilisateur. Un jeu de
niveaux est rejeté quand l'entrée est à plus de 1,5 ATR du prix courant,
quand l'ordre entrée/stop/take profits est incohérent avec la direction,
quand la distance de stop sort de la fourchette 0,25–4 ATR, ou quand le TP1
n'offre même pas 1R. Dans ce cas les niveaux sont reconstruits sur l'ATR
(stop à 0,8 / 1,2 / 1,8 ATR selon l'horizon, take profits en 1,2R / 2R / 3R),
la confiance est plafonnée à 55 et l'utilisateur est prévenu dans
`market_warning`.

Le signal est ensuite écrit dans `signals` et le quota incrémenté.

### Le fournisseur IA : DeepSeek

`src/lib/ai-gateway.server.ts` appelle l'API DeepSeek directement (elle est
compatible OpenAI, d'où le même client `@ai-sdk/openai-compatible` déjà
utilisé). Base URL confirmée depuis la page officielle *Models & Pricing* de
DeepSeek : `https://api.deepseek.com` (sans `/v1` — le client n'ajoute que
`/chat/completions`).

- `DEEPSEEK_API_KEY` — votre clé, depuis platform.deepseek.com
- `DEEPSEEK_MODEL` — id du modèle. Défaut : `deepseek-v4-pro` (id confirmé
  sur la page *Models & Pricing* de DeepSeek — support JSON Output et Tool
  Calls vérifié, ce dont dépend la sortie structurée du signal). Modifiable
  pour tester une autre variante, par exemple `deepseek-v4-flash`.

Sans `DEEPSEEK_API_KEY`, la génération de signal échoue avec un message
explicite plutôt que d'appeler l'API sans authentification.

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
étiqueté « estimé » dans l'interface et signalé comme tel dans le prompt
envoyé au modèle.

---

## Structure du code

```
src/
├── routes/                 # pages (TanStack Router)
├── components/             # UI : SignalCard, DepthChart, TimeframePanel…
├── lib/
│   ├── ai-gateway.server.ts    # client DeepSeek
│   ├── market/                 # sources de marché, symboles, cache
│   ├── signals/
│   │   ├── analysis.server.ts  # ICT/SMC déterministe
│   │   ├── signals.server.ts   # prompt + appel LLM
│   │   ├── validate.ts         # garde-fou sur les niveaux
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

### 1. Créer votre propre projet Supabase

Sur [supabase.com](https://supabase.com), nouveau projet (plan gratuit
suffisant pour démarrer). Récupérez dans *Project Settings > API* :
`SUPABASE_URL` et la clé publishable.

Appliquez le schéma : dans l'éditeur SQL du projet, exécutez dans l'ordre
les fichiers de `supabase/migrations/` (ils sont numérotés
chronologiquement).

Pour la connexion Google (optionnelle) : *Authentication > Providers >
Google*, avec vos propres identifiants OAuth Google Cloud.

### 2. Créer une clé DeepSeek

Sur [platform.deepseek.com](https://platform.deepseek.com), générez une clé
API. Notez l'id exact du modèle que vous voulez utiliser depuis la
documentation ou le tableau de bord DeepSeek.

### 3. Variables d'environnement

```bash
cp .env.example .env
# puis remplissez SUPABASE_*, VITE_SUPABASE_*, DEEPSEEK_API_KEY, DEEPSEEK_MODEL
```

### 4. Développement

```bash
bun install
bun run dev        # http://localhost:8080
bun run lint
bun run format
bun run build
```

### 5. Hébergement

Le build cible Cloudflare Workers par défaut (`nitro({ preset:
"cloudflare-module" })` dans `vite.config.ts`) :

```bash
bun run build
npx wrangler deploy --prebuilt
```

Nécessite un compte Cloudflare (plan gratuit suffisant pour démarrer) et les
variables d'environnement configurées côté Worker (Supabase + DeepSeek,
mêmes noms que `.env`).

---

## Reste à faire

- Paiement Stripe (bouton Pro en démo)
- Confirmer l'id de modèle DeepSeek exact et valider le format de sortie
  structuré (`Output.object`) contre l'API réelle
- Notifications Telegram et email
- Basculer la synchronisation des positions en tâche de fond planifiée
- News et calendrier économique
- Déploiement initial et premier lien public

---

Le trading comporte un risque de perte en capital. Les signaux produits par
cette application sont une aide à la décision, pas un conseil en
investissement.
