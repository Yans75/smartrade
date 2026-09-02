-- Replace has_role() usage in policies with an inline own-row check so the
-- SECURITY DEFINER function no longer needs to be callable by signed-in users.
DROP POLICY "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
);

DROP POLICY "Users can view their own signals" ON public.signals;
CREATE POLICY "Users can view their own signals" ON public.signals
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
);

DROP POLICY "Users can view their own usage" ON public.signal_usage;
CREATE POLICY "Users can view their own usage" ON public.signal_usage
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;