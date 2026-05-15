-- ═══════════════════════════════════════════════════════════════
-- Migration 011: Role-Based Access Control (RBAC)
--
-- Restricts access to sensitive HR tables based on user_profiles.role.
-- Only admin and hr roles can access salary, email, and review data.
-- Service role policies remain for server-side API routes.
-- ═══════════════════════════════════════════════════════════════

-- Helper function: check if current user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(required_roles text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()::text
      AND role = ANY(required_roles)
  );
$$;

-- ═══════════════════════════════════════
-- HR SALARY — restrict to admin, hr
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "Allow authenticated access" ON hr_salary;
CREATE POLICY "hr_salary: admin and hr only"
  ON hr_salary FOR ALL TO authenticated
  USING (public.user_has_role(ARRAY['admin', 'hr']))
  WITH CHECK (public.user_has_role(ARRAY['admin', 'hr']));

-- ═══════════════════════════════════════
-- HR PAYSLIPS — restrict to admin, hr
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "Allow authenticated access" ON hr_payslips;
CREATE POLICY "hr_payslips: admin and hr only"
  ON hr_payslips FOR ALL TO authenticated
  USING (public.user_has_role(ARRAY['admin', 'hr']))
  WITH CHECK (public.user_has_role(ARRAY['admin', 'hr']));

-- ═══════════════════════════════════════
-- HR EMAILS — restrict to admin, hr
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "Allow authenticated access" ON hr_emails;
CREATE POLICY "hr_emails: admin and hr only"
  ON hr_emails FOR ALL TO authenticated
  USING (public.user_has_role(ARRAY['admin', 'hr']))
  WITH CHECK (public.user_has_role(ARRAY['admin', 'hr']));

-- ═══════════════════════════════════════
-- HR PERFORMANCE REVIEWS — restrict to admin, hr
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "Allow authenticated access" ON hr_performance_reviews;
CREATE POLICY "hr_reviews: admin and hr only"
  ON hr_performance_reviews FOR ALL TO authenticated
  USING (public.user_has_role(ARRAY['admin', 'hr']))
  WITH CHECK (public.user_has_role(ARRAY['admin', 'hr']));

-- ═══════════════════════════════════════
-- HR EMPLOYEE DOCUMENTS — restrict to admin, hr
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "Allow authenticated access" ON hr_employee_documents;
CREATE POLICY "hr_documents: admin and hr only"
  ON hr_employee_documents FOR ALL TO authenticated
  USING (public.user_has_role(ARRAY['admin', 'hr']))
  WITH CHECK (public.user_has_role(ARRAY['admin', 'hr']));

-- ═══════════════════════════════════════
-- HR LEAVE REQUESTS — employees can see own, admin/hr see all
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "Allow authenticated access" ON hr_leave_requests;
CREATE POLICY "hr_leave: admin and hr full access"
  ON hr_leave_requests FOR ALL TO authenticated
  USING (public.user_has_role(ARRAY['admin', 'hr']))
  WITH CHECK (public.user_has_role(ARRAY['admin', 'hr']));

-- ═══════════════════════════════════════
-- HR LEAVE BALANCES — restrict to admin, hr
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "Allow authenticated access" ON hr_leave_balances;
CREATE POLICY "hr_leave_balances: admin and hr only"
  ON hr_leave_balances FOR ALL TO authenticated
  USING (public.user_has_role(ARRAY['admin', 'hr']))
  WITH CHECK (public.user_has_role(ARRAY['admin', 'hr']));

-- ═══════════════════════════════════════
-- USER PROFILES — everyone reads own, admin reads all
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "Allow authenticated access" ON user_profiles;

-- All users can read their own profile
CREATE POLICY "user_profiles: own profile read"
  ON user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid()::text);

-- Admins can read all profiles
CREATE POLICY "user_profiles: admin read all"
  ON user_profiles FOR SELECT TO authenticated
  USING (public.user_has_role(ARRAY['admin']));

-- Only admins can update profiles
CREATE POLICY "user_profiles: admin update"
  ON user_profiles FOR UPDATE TO authenticated
  USING (public.user_has_role(ARRAY['admin']))
  WITH CHECK (public.user_has_role(ARRAY['admin']));

-- Allow upsert for auto-create on first login (user can insert own)
CREATE POLICY "user_profiles: self insert"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid()::text);

-- Admin can delete
CREATE POLICY "user_profiles: admin delete"
  ON user_profiles FOR DELETE TO authenticated
  USING (public.user_has_role(ARRAY['admin']));
