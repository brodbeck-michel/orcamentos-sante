
-- =========================================================
-- Tabela: atendentes
-- =========================================================
CREATE TABLE public.atendentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX atendentes_nome_unique_ci ON public.atendentes (lower(nome));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atendentes TO authenticated;
GRANT ALL ON public.atendentes TO service_role;

ALTER TABLE public.atendentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atendentes_select_authenticated" ON public.atendentes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "atendentes_insert_admin" ON public.atendentes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "atendentes_update_admin" ON public.atendentes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "atendentes_delete_admin" ON public.atendentes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tg_atendentes_updated
  BEFORE UPDATE ON public.atendentes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- Tabela: exames
-- =========================================================
CREATE TABLE public.exames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nome text NOT NULL,
  categoria text,
  sinonimos text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX exames_codigo_unique_ci ON public.exames (lower(codigo));
CREATE INDEX exames_nome_idx ON public.exames (lower(nome));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exames TO authenticated;
GRANT ALL ON public.exames TO service_role;

ALTER TABLE public.exames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exames_select_authenticated" ON public.exames
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "exames_insert_admin" ON public.exames
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "exames_update_admin" ON public.exames
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "exames_delete_admin" ON public.exames
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tg_exames_updated
  BEFORE UPDATE ON public.exames
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- Seed: atendentes iniciais
-- =========================================================
INSERT INTO public.atendentes (nome) VALUES
  ('Ana Paula'), ('Camilly'), ('Carol'), ('Cintia'), ('Diana'),
  ('Eduardam'), ('Indi'), ('Tainá'), ('Mariane')
ON CONFLICT (lower(nome)) DO NOTHING;

-- Importar nomes já usados em vendas
INSERT INTO public.atendentes (nome)
SELECT DISTINCT TRIM(atendente)
FROM public.vendas
WHERE atendente IS NOT NULL AND TRIM(atendente) <> ''
ON CONFLICT (lower(nome)) DO NOTHING;

-- Importar nomes já vinculados em profiles
INSERT INTO public.atendentes (nome)
SELECT DISTINCT TRIM(atendente)
FROM public.profiles
WHERE atendente IS NOT NULL AND TRIM(atendente) <> ''
ON CONFLICT (lower(nome)) DO NOTHING;

-- =========================================================
-- Seed: catálogo de exames existente
-- =========================================================
INSERT INTO public.exames (codigo, nome, categoria, sinonimos) VALUES
  ('HEM001','Hemograma Completo','Hematologia','Hemograma, CBC, Contagem Sanguínea Completa'),
  ('BIO001','Glicemia de Jejum','Bioquímica','Glicose Jejum, Glicemia Basal'),
  ('BIO002','Hemoglobina Glicada','Bioquímica','HbA1c, A1C, Glico-Hemoglobina'),
  ('BIO003','Colesterol Total','Bioquímica','CT'),
  ('BIO004','HDL Colesterol','Bioquímica','HDL, Colesterol Bom'),
  ('BIO005','LDL Colesterol','Bioquímica','LDL, Colesterol Ruim'),
  ('BIO006','Triglicerídeos','Bioquímica','TG, Triglicérides'),
  ('BIO007','Creatinina','Bioquímica','Creat'),
  ('BIO008','Ureia','Bioquímica','Uréia'),
  ('BIO009','Ácido Úrico','Bioquímica','Acido Urico'),
  ('BIO010','TGO','Bioquímica','AST, Aspartato Aminotransferase'),
  ('BIO011','TGP','Bioquímica','ALT, Alanina Aminotransferase'),
  ('BIO012','Gama GT','Bioquímica','GGT, Gamma GT'),
  ('BIO013','Fosfatase Alcalina','Bioquímica','FA'),
  ('BIO014','Bilirrubina Total','Bioquímica','BT'),
  ('BIO015','Bilirrubina Direta','Bioquímica','BD'),
  ('BIO016','Bilirrubina Indireta','Bioquímica','BI'),
  ('BIO017','Proteína C Reativa','Imunologia','PCR, CRP'),
  ('BIO018','Ferritina','Bioquímica','Ferritina Sérica'),
  ('BIO019','Ferro Sérico','Bioquímica','Ferro'),
  ('BIO020','Vitamina D','Vitaminas','25-OH Vitamina D, Calcidiol'),
  ('BIO021','Vitamina B12','Vitaminas','Cobalamina'),
  ('BIO022','Ácido Fólico','Vitaminas','Folato'),
  ('BIO023','Glicose (Sangue)','Bioquímica','Glicemia, GLI'),
  ('BIO024','Glicose - Plasma','Bioquímica','GLIPL, Glicemia Plasmática'),
  ('BIO025','Potássio (Sangue)','Bioquímica','K, POT'),
  ('BIO026','Sódio (Sangue)','Bioquímica','Na, NA'),
  ('BIO027','Cálcio (Sangue)','Bioquímica','Ca, CAL'),
  ('BIO028','Magnésio','Bioquímica','Mg, MG'),
  ('BIO029','Zinco (Soro)','Bioquímica','Zn, ZIN'),
  ('BIO030','CPK','Bioquímica','Creatinofosfoquinase, Creatina Quinase, CK'),
  ('BIO031','Lipidograma Completo','Bioquímica','Perfil Lipídico, LID'),
  ('HOR001','TSH','Hormônios','Hormônio Tireoestimulante'),
  ('HOR002','T4 Livre','Hormônios','FT4, Tiroxina Livre'),
  ('HOR003','T3 Livre','Hormônios','FT3, Triiodotironina Livre'),
  ('HOR004','Anti-TPO','Hormônios','Anticorpo Anti Peroxidase'),
  ('HOR005','Anti-Tireoglobulina','Hormônios','Anti-Tg'),
  ('HOR006','Insulina','Hormônios','Insulina Basal'),
  ('HOR007','Cortisol','Hormônios','Cortisol Sérico'),
  ('HOR008','ACTH','Hormônios','Hormônio Adrenocorticotrófico'),
  ('HOR009','Testosterona Total','Hormônios','Testo Total'),
  ('HOR010','Testosterona Livre','Hormônios','Testo Livre'),
  ('HOR011','Estradiol','Hormônios','E2'),
  ('HOR012','Progesterona','Hormônios','Progesterona Sérica'),
  ('HOR013','FSH','Hormônios','Hormônio Folículo Estimulante'),
  ('HOR014','LH','Hormônios','Hormônio Luteinizante'),
  ('HOR015','Prolactina','Hormônios','PRL'),
  ('HOR016','Beta HCG','Hormônios','β-HCG, Teste de Gravidez'),
  ('URI001','EAS','Urinálise','Urina Tipo I, Sumário de Urina'),
  ('URI002','Urocultura','Microbiologia','Cultura de Urina'),
  ('URI003','Microalbuminúria','Urinálise','Albumina Urinária'),
  ('URI004','Proteinúria 24h','Urinálise','Proteína 24 Horas'),
  ('URI005','Clearance de Creatinina','Urinálise','Depuração de Creatinina'),
  ('HEM002','Coagulograma','Hematologia','Perfil de Coagulação'),
  ('HEM003','TP','Hematologia','Tempo de Protrombina'),
  ('HEM004','INR','Hematologia','Razão Normalizada Internacional'),
  ('HEM005','TTPA','Hematologia','Tempo de Tromboplastina Parcial Ativada'),
  ('HEM006','D-Dímero','Hematologia','Dímero D'),
  ('HEM007','Fibrinogênio','Hematologia','Fibrinogenio'),
  ('HEM008','VHS','Hematologia','Hemossedimentação, Velocidade de Hemossedimentação'),
  ('IMU001','Fator Reumatoide','Imunologia','FR'),
  ('IMU002','FAN','Imunologia','Fator Antinuclear'),
  ('IMU003','ASLO','Imunologia','Antiestreptolisina O'),
  ('IMU004','C3','Imunologia','Complemento C3'),
  ('IMU005','C4','Imunologia','Complemento C4'),
  ('SOR001','HIV 1 e 2','Sorologia','Anti-HIV'),
  ('SOR002','VDRL','Sorologia','Sífilis VDRL'),
  ('SOR003','FTA-ABS','Sorologia','Sífilis Confirmatório'),
  ('SOR004','HBsAg','Sorologia','Hepatite B'),
  ('SOR005','Anti-HBs','Sorologia','Imunidade Hepatite B'),
  ('SOR006','Anti-HCV','Sorologia','Hepatite C'),
  ('SOR007','Toxoplasmose IgG','Sorologia','Toxo IgG'),
  ('SOR008','Toxoplasmose IgM','Sorologia','Toxo IgM'),
  ('SOR009','CMV IgG','Sorologia','Citomegalovírus IgG'),
  ('SOR010','CMV IgM','Sorologia','Citomegalovírus IgM'),
  ('MIC001','Coprocultura','Microbiologia','Cultura de Fezes'),
  ('MIC002','Parasitológico de Fezes','Microbiologia','EPF, Exame de Fezes'),
  ('MIC003','Sangue Oculto nas Fezes','Microbiologia','PSOF'),
  ('MIC004','Influenza A/B','Virologia','Gripe A e B'),
  ('MIC005','SARS-CoV-2 PCR','Virologia','PCR COVID'),
  ('MIC006','Dengue NS1','Virologia','Antígeno NS1'),
  ('MIC007','Dengue IgM','Virologia','Sorologia Dengue IgM'),
  ('MIC008','Dengue IgG','Virologia','Sorologia Dengue IgG'),
  ('MIC009','Antibiograma','Microbiologia','TSA, Teste de Sensibilidade a Antimicrobianos'),
  ('ONC001','PSA Total','Marcadores Tumorais','Antígeno Prostático Específico'),
  ('TOX001','Exame Toxicológico (Drogas de Abuso)','Toxicologia','Toxicológico, Drogas de Abuso'),
  -- Check-ups (da imagem)
  ('CKALE','Check-up Alérgenos (Principais)','Check-up',NULL),
  ('CKBAR','Check-up Bariátrico','Check-up',NULL),
  ('CKBAS','Check-up Básico Homem/Mulher','Check-up',NULL),
  ('CKCEL','Check-up Celíaco','Check-up',NULL),
  ('CKHOM','Check-up Homem','Check-up',NULL),
  ('CKHF','Check-up Homem Fitness','Check-up',NULL),
  ('CKINF','Check-up Infantil (até 12 anos)','Check-up',NULL),
  ('CKMOU','Check-up Mounjaro','Check-up',NULL),
  ('CKMU','Check-up Mulher','Check-up',NULL),
  ('CKMF','Check-up Mulher Fitness','Check-up',NULL),
  ('CKMM','Check-up Mulher - Menopausa','Check-up',NULL),
  ('CKNUT','Check-up Nutrição','Check-up',NULL),
  ('CKVEG','Check-up Vegano','Check-up',NULL),
  ('CKVIT','Check-up Vitaminas','Check-up',NULL)
ON CONFLICT (lower(codigo)) DO NOTHING;
