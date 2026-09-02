# Smartrade — roadmap

## Fait
- Fork indépendant de SmartSignal : plus aucune dépendance à Lovable (build,
  auth OAuth, fournisseur IA) — Supabase et l'hébergement sont sous votre
  propre compte
- Design system "Tactical Quant" + 9 pages FR (marketing, login, register, dashboard, historique, stats, paramètres, admin, succès paiement)
- Auth réelle (email/mot de passe + Google natif via Supabase Auth), profils, rôles
- Données marché réelles : Binance/OKX/Bybit (crypto) + Twelve Data et Yahoo (forex/matières/indices), spot dédié pour les métaux
- Analyse technique automatisée ICT/SMC (structure, FVG, BOS, ATR) sur 4 unités de temps
- Génération de signaux par LLM (DeepSeek `deepseek-v4-pro`, appelé directement) persistés en base
- Garde-fou déterministe sur les niveaux : tout jeu entrée/stop/TP incohérent est recalculé sur l'ATR avant d'être servi
- Suivi automatique du résultat des signaux : les bougies sont rejouées, TP/SL détectés, statut et PnL mis à jour
- Quota 3 signaux/jour appliqué côté serveur + signaux bonus
- Historique, statistiques et courbe de PnL sur données réelles
- Export CSV réel de l'historique
- Espace admin : liste utilisateurs, bascule free/premium, reset quota, bonus, rôle admin, suppression
- Durcissement sécurité RLS (has_role non exécutable par les clients)

## Reste à faire
- Créer le projet Supabase indépendant et y appliquer les migrations (voir README > Mise en route)
- Premier appel réel à DeepSeek pour valider bout en bout (clé configurée, jamais encore testée : le réseau de cet environnement de dev bloque deepseek.com)
- Premier déploiement (Cloudflare Workers, build déjà configuré) et premier lien public
- Paiement Stripe abonnement Pro 29 €/mois (bouton actuellement en démo)
- Basculer la synchronisation des positions en tâche planifiée côté serveur (aujourd'hui déclenchée à la consultation, throttlée à 1 passe/minute/utilisateur)
- Alertes e-mail / notifications Telegram (interface retirée tant que le backend n'existe pas)
- Clé Twelve Data : plan gratuit limité à 8 requêtes/minute → cache à renforcer si beaucoup d'utilisateurs
- Export PDF (le bouton déclenche aujourd'hui l'impression navigateur)
- News & calendrier économique (contexte fondamental)
