-- ============================================================
-- Construction Finishing Company — Full Schema
-- Multi-tenant: all tables include company_id
-- Run after rls-hardening.sql
-- ============================================================

-- ── Projects ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    text NOT NULL,
  name          text NOT NULL,
  client_name   text NOT NULL,
  client_phone  text,
  location      text,
  description   text,
  type          text NOT NULL DEFAULT 'apartment'  CHECK (type IN ('apartment','shop','villa','office','other')),
  status        text NOT NULL DEFAULT 'planning'   CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  engineer_name text,
  start_date    date,
  end_date      date,
  expected_cost numeric(14,2) DEFAULT 0,
  actual_cost   numeric(14,2) DEFAULT 0,
  contract_value numeric(14,2) DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── Workers ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_workers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  text NOT NULL,
  name        text NOT NULL,
  job_type    text NOT NULL DEFAULT 'general' CHECK (job_type IN ('plumber','electrician','painter','carpenter','tiler','mason','welder','general','supervisor','other')),
  daily_rate  numeric(10,2) DEFAULT 0,
  phone       text,
  status      text NOT NULL DEFAULT 'available' CHECK (status IN ('available','busy','inactive')),
  rating      numeric(2,1) DEFAULT 5.0 CHECK (rating BETWEEN 0 AND 5),
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ── Tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  text NOT NULL,
  project_id  uuid NOT NULL REFERENCES con_projects(id) ON DELETE CASCADE,
  worker_id   uuid REFERENCES con_workers(id) ON DELETE SET NULL,
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done','blocked')),
  priority    text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  progress    int  NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  start_date  date,
  due_date    date,
  completed_at timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ── Expenses ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     text NOT NULL,
  project_id     uuid REFERENCES con_projects(id) ON DELETE SET NULL,
  category       text NOT NULL DEFAULT 'materials' CHECK (category IN ('materials','labor','equipment','transport','subcontract','other')),
  description    text NOT NULL,
  amount         numeric(14,2) NOT NULL DEFAULT 0,
  supplier       text,
  payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash','transfer','check','credit')),
  expense_date   date NOT NULL DEFAULT CURRENT_DATE,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- ── Materials ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_materials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   text NOT NULL,
  project_id   uuid REFERENCES con_projects(id) ON DELETE SET NULL,
  name         text NOT NULL,
  supplier     text,
  unit         text DEFAULT 'unit' CHECK (unit IN ('unit','kg','ton','m','m2','m3','liter','box','bag','roll','other')),
  quantity     numeric(12,3) NOT NULL DEFAULT 0,
  unit_price   numeric(12,2) NOT NULL DEFAULT 0,
  total_price  numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  purchase_date date DEFAULT CURRENT_DATE,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

-- ── Payments ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     text NOT NULL,
  project_id     uuid REFERENCES con_projects(id) ON DELETE SET NULL,
  type           text NOT NULL DEFAULT 'incoming' CHECK (type IN ('incoming','outgoing')),
  amount         numeric(14,2) NOT NULL DEFAULT 0,
  description    text NOT NULL,
  payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash','transfer','check','credit')),
  payment_date   date NOT NULL DEFAULT CURRENT_DATE,
  reference      text,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- ── Files ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  text NOT NULL,
  project_id  uuid REFERENCES con_projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  url         text NOT NULL,
  file_type   text DEFAULT 'image',
  category    text DEFAULT 'site' CHECK (category IN ('site','before','after','contract','invoice','blueprint','other')),
  size_bytes  bigint DEFAULT 0,
  uploaded_at timestamptz DEFAULT now()
);

-- ── Worker daily log (attendance/payments) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_worker_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  text NOT NULL,
  project_id  uuid REFERENCES con_projects(id) ON DELETE CASCADE,
  worker_id   uuid NOT NULL REFERENCES con_workers(id) ON DELETE CASCADE,
  log_date    date NOT NULL DEFAULT CURRENT_DATE,
  days_worked numeric(3,1) DEFAULT 1,
  amount_paid numeric(10,2) DEFAULT 0,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

-- ── Enable RLS ────────────────────────────────────────────────────────────────
DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'con_projects','con_workers','con_tasks','con_expenses',
    'con_materials','con_payments','con_files','con_worker_logs'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ── RLS Policies ──────────────────────────────────────────────────────────────
DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'con_projects','con_workers','con_tasks','con_expenses',
    'con_materials','con_payments','con_files','con_worker_logs'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "tenant_isolation" ON %I FOR ALL
       USING (company_id::text = public.current_company_id())
       WITH CHECK (company_id::text = public.current_company_id())',
      t
    );
  END LOOP;
END $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_con_projects_company ON con_projects(company_id, status);
CREATE INDEX IF NOT EXISTS idx_con_workers_company  ON con_workers(company_id, status);
CREATE INDEX IF NOT EXISTS idx_con_tasks_project    ON con_tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_con_expenses_project ON con_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_con_materials_project ON con_materials(project_id);
CREATE INDEX IF NOT EXISTS idx_con_payments_project  ON con_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_con_files_project     ON con_files(project_id);
CREATE INDEX IF NOT EXISTS idx_con_worker_logs_proj  ON con_worker_logs(project_id, log_date);

-- ── Auto-update actual_cost on projects ───────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_project_actual_cost()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE con_projects
  SET actual_cost = (
    SELECT COALESCE(SUM(amount), 0)
    FROM con_expenses
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_cost ON con_expenses;
CREATE TRIGGER trg_sync_project_cost
  AFTER INSERT OR UPDATE OR DELETE ON con_expenses
  FOR EACH ROW EXECUTE FUNCTION sync_project_actual_cost();

-- ── Budget overrun notification helper ────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_budget_overrun()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.actual_cost > NEW.expected_cost AND NEW.expected_cost > 0 THEN
    INSERT INTO notifications(company_id, title, message, type, entity_type, entity_id)
    SELECT NEW.company_id,
           'تجاوز الميزانية',
           'مشروع "' || NEW.name || '" تجاوز الميزانية المتوقعة بمقدار ' ||
           ROUND(NEW.actual_cost - NEW.expected_cost)::text,
           'warning', 'con_projects', NEW.id::text
    WHERE EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'notifications' AND table_schema = 'public'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_overrun ON con_projects;
CREATE TRIGGER trg_budget_overrun
  AFTER UPDATE OF actual_cost ON con_projects
  FOR EACH ROW EXECUTE FUNCTION check_budget_overrun();
