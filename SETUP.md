# Mise en route de Smartrade

De zéro à une app qui tourne en local. Compter ~15 minutes.

---

## 1. Créer le projet Supabase

1. [supabase.com](https://supabase.com) → **New project** (le plan gratuit
   suffit largement pour démarrer : 500 Mo de base, 50 000 utilisateurs actifs).
2. Notez le mot de passe de base de données proposé — il ne sert pas ici mais
   Supabase ne le réaffiche jamais.
3. Attendre ~2 minutes que le projet finisse de se provisionner.

## 2. Créer les tables

Dashboard → **SQL Editor** → **New query** → coller tout le contenu de
[`supabase/schema.sql`](supabase/schema.sql) → **Run**.

Un seul copier-coller suffit : ce fichier contient l'état final du schéma
(tables, index, RLS, triggers, durcissement des fonctions). Il est
ré-exécutable sans erreur si vous devez le rejouer.

> Le dossier `supabase/migrations/` garde l'historique migration par migration
> pour référence — sur un projet neuf, ne l'utilisez pas, il se corrige
> lui-même en cours de route.

Vérification rapide : Dashboard → **Table Editor**, vous devez voir
`profiles`, `signals`, `signal_usage`, `user_roles`.

## 3. Récupérer les clés

Dashboard → **Project Settings** → **API** :

| Ce qu'il vous faut | Où le trouver | Variable |
| --- | --- | --- |
| URL du projet | *Project URL* | `SUPABASE_URL` et `VITE_SUPABASE_URL` |
| Clé publique | *Publishable key* (`sb_publishable_…`) ou *anon public* | `SUPABASE_PUBLISHABLE_KEY` et `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Clé serveur | *Secret key* / *service_role* | `SUPABASE_SERVICE_ROLE_KEY` |

La clé publique est faite pour être exposée au navigateur — c'est la RLS qui
protège les données. **La clé service_role contourne la RLS** : elle ne sort
jamais du serveur, ne la mettez jamais dans une variable préfixée `VITE_`.
Elle ne sert qu'à l'espace admin.

## 4. Remplir `.env`

```bash
cp .env.example .env
```

Puis renseignez les 5 variables Supabase ci-dessus. `DEEPSEEK_API_KEY` et
`DEEPSEEK_MODEL` sont déjà documentées dans le même fichier.

`.env` est gitignoré : vos clés ne partiront jamais sur GitHub.

## 5. Configurer l'authentification

Dashboard → **Authentication** → **URL Configuration** :

- **Site URL** : `http://localhost:8080` (à remplacer par l'URL de production
  après le déploiement)
- **Redirect URLs** : ajouter `http://localhost:8080/**`

Sans ça, les liens de confirmation d'email et le retour de connexion Google
renvoient vers une mauvaise adresse.

**Pour tester vite** : Authentication → **Sign In / Providers** → Email →
désactiver **Confirm email**. Sinon chaque inscription attend une validation
par email avant d'ouvrir une session, et vous resterez bloqué à la porte.

**Connexion Google** (optionnel) : Authentication → Sign In / Providers →
Google → activer, avec vos identifiants OAuth depuis Google Cloud Console.
L'app appelle `supabase.auth.signInWithOAuth` — rien à changer dans le code.

## 6. Lancer l'app

```bash
bun install
bun run dev
```

→ [http://localhost:8080](http://localhost:8080)

Créez votre compte via la page **Inscription**.

## 7. Se donner les droits admin

Le trigger d'inscription attribue le rôle `user` à tout le monde. Pour accéder
à `/admin`, exécutez ceci dans le SQL Editor **après avoir créé votre compte** :

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'votre@email.com'
on conflict (user_id, role) do nothing;
```

Déconnectez-vous / reconnectez-vous pour que le rôle soit rechargé.

## 8. Déployer

Le build cible Cloudflare Workers (gratuit pour démarrer) :

```bash
bun run build
npx wrangler deploy --prebuilt
```

Reportez ensuite les mêmes variables d'environnement côté Worker
(`npx wrangler secret put NOM_DE_LA_VARIABLE` pour chacune), et ajoutez
l'URL de production dans la configuration d'authentification Supabase
(étape 5).

---

## Problèmes courants

| Symptôme | Cause |
| --- | --- |
| `Missing Supabase environment variable(s)` | `.env` incomplet, ou serveur de dev non redémarré après modification |
| Inscription sans redirection vers le dashboard | *Confirm email* actif (étape 5) |
| Retour de connexion Google sur une mauvaise URL | *Redirect URLs* non configurées (étape 5) |
| `/admin` refuse l'accès | Rôle admin non attribué (étape 7), ou session pas rechargée |
| `Clé API DeepSeek invalide ou manquante` | `DEEPSEEK_API_KEY` absente de `.env` |
| Signaux générés mais aucune stat | Normal tant qu'aucune position n'est clôturée : le win rate ne compte que les trades résolus (TP/SL atteint ou expiration) |
