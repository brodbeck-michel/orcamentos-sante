-- Allow role 'user' to also manage exames alongside admin
DROP POLICY IF EXISTS exames_insert_admin ON public.exames;
DROP POLICY IF EXISTS exames_update_admin ON public.exames;
DROP POLICY IF EXISTS exames_delete_admin ON public.exames;

CREATE POLICY exames_insert_admin_or_user ON public.exames
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'user'::app_role));

CREATE POLICY exames_update_admin_or_user ON public.exames
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'user'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'user'::app_role));

CREATE POLICY exames_delete_admin_or_user ON public.exames
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'user'::app_role));