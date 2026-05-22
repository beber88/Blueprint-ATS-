-- Blueprint HR — Add government ID fields to op_employees
-- SSS, PhilHealth, Pag-IBIG, TIN for payroll compliance
-- IDEMPOTENT — SAFE TO RE-RUN.

ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS sss_number TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS philhealth_number TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS pagibig_number TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS tin_number TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS date_of_birth_raw TEXT;
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS employee_id_number TEXT;