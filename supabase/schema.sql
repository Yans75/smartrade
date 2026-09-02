-- Smartrade — schéma complet, à exécuter en une fois dans l'éditeur SQL
-- d'un projet Supabase neuf (Dashboard > SQL Editor > New query > coller > Run).
--
-- Ce fichier représente l'ÉTAT FINAL du schéma, pas le rejeu des migrations
-- de supabase/migrations/ (qui se corrigent entre elles). Sur un projet neuf,
-- utilisez ce fichier. Il est ré-exécutable sans erreur.
--
-- Validé sur PostgreSQL 16 : exécution sur base vierge puis ré-exécution,
-- création automatique du profil et du rôle à l'inscription, cascade de
-- suppression, et isolation RLS (un utilisateur ne lit que ses lignes, ne
-- peut ni insérer ni modifier au nom d'un autre, et ne peut pas appeler
-- has_role ; un admin voit tout).

-- ---------------------------------------------------------------- rôles ----

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Conservée pour rester alignée avec les types générés (src/integrations/
-- supabase/types.ts), mais plus utilisée par aucune policy et non exécutable
-- par les clients : les policies font un EXISTS en ligne à la place.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- --------------------------------------------------------------- profils ----

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  subscription_ends_at TIMESTAMPTZ,
  bonus_signals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Crée le profil + le rôle "user" à chaque inscription (email ou Google).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------- signaux ----

CREATE TABLE IF NOT EXISTS public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  stop_loss NUMERIC NOT NULL,
  take_profit_1 NUMERIC NOT NULL,
  take_profit_2 NUMERIC NOT NULL,
  take_profit_3 NUMERIC NOT NULL,
  confidence_score INTEGER NOT NULL,
  trading_mode TEXT NOT NULL,
  strategy TEXT NOT NULL DEFAULT 'ict_smc',
  timeframe_analysis JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_flow_confirmation JSONB,
  reasoning TEXT,
  position_advice TEXT,
  market_warning TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  pnl_percent NUMERIC,
  closed_price NUMERIC,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS signals_user_created_idx ON public.signals (user_id, created_at DESC);
-- Le suivi automatique des TP/SL ne lit que les positions encore ouvertes.
CREATE INDEX IF NOT EXISTS signals_open_idx ON public.signals (user_id) WHERE closed_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signals TO authenticated;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own signals" ON public.signals;
CREATE POLICY "Users can view their own signals" ON public.signals
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can insert their own signals" ON public.signals;
CREATE POLICY "Users can insert their own signals" ON public.signals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own signals" ON public.signals;
CREATE POLICY "Users can update their own signals" ON public.signals
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own signals" ON public.signals;
CREATE POLICY "Users can delete their own signals" ON public.signals
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- --------------------------------------------------------- quota quotidien --

CREATE TABLE IF NOT EXISTS public.signal_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  signals_used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);
GRANT SELECT, INSERT, UPDATE ON public.signal_usage TO authenticated;
GRANT ALL ON public.signal_usage TO service_role;
ALTER TABLE public.signal_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own usage" ON public.signal_usage;
CREATE POLICY "Users can view their own usage" ON public.signal_usage
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can insert their own usage" ON public.signal_usage;
CREATE POLICY "Users can insert their own usage" ON public.signal_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own usage" ON public.signal_usage;
CREATE POLICY "Users can update their own usage" ON public.signal_usage
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------- durcissement --
-- Aucune de ces fonctions ne doit être appelable depuis le navigateur.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon, authenticated, public;
