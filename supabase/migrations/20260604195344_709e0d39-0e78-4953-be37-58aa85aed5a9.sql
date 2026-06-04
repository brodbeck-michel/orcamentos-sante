CREATE TABLE public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atendente text NOT NULL,
  data_venda date NOT NULL,
  codigo text NOT NULL,
  valor numeric(12,2) NOT NULL,
  exames text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('exames','checkup')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas TO authenticated;
GRANT ALL ON public.vendas TO service_role;

ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view all vendas"
  ON public.vendas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert vendas"
  ON public.vendas FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owner or admin can update vendas"
  ON public.vendas FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or admin can delete vendas"
  ON public.vendas FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER vendas_set_updated_at
  BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX vendas_data_venda_idx ON public.vendas (data_venda DESC);
CREATE INDEX vendas_atendente_idx ON public.vendas (atendente);