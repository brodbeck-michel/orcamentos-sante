
-- Add 'atendente' value to app_role enum (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'atendente'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'atendente';
  END IF;
END $$;

-- Link a profile to an attendant name from orçamentos
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS atendente text;

-- Restrict vendas SELECT: own rows or admin
DROP POLICY IF EXISTS "Authenticated can view all vendas" ON public.vendas;
CREATE POLICY "Own or admin can view vendas"
  ON public.vendas
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
