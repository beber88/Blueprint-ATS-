-- Blueprint HR — Operations Intelligence Module: Seed Data
-- This migration seeds the master tables with Blueprint Building Group's real organizational data
-- (departments, active projects, core team) so dashboards are populated on first run.
--
-- Run AFTER 002_operations_intelligence.sql. Idempotent — safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- Departments — overwrite the minimal seed in 002 with the full org structure
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO op_departments (code, name, name_he, name_en, name_tl, color) VALUES
  ('hr',             'משאבי אנוש',              'משאבי אנוש',          'HR',                       'HR',                       '#C9A84C'),
  ('admin',          'מנהלה ומזכירות',           'מנהלה ומזכירות',      'Administration',           'Administrasyon',           '#1A56A8'),
  ('architecture',   'אדריכלות ועיצוב',          'אדריכלות ועיצוב',     'Architecture & Design',    'Arkitektura at Disenyo',   '#5B3F9E'),
  ('projects',       'ניהול פרויקטים ואתר',      'ניהול פרויקטים ואתר', 'Project Management',       'Pamamahala ng Proyekto',   '#3D8A7D'),
  ('procurement',    'רכש',                      'רכש',                  'Procurement',              'Pagkuha',                  '#A88B3D'),
  ('qs',             'בקרת כמויות',              'בקרת כמויות',          'Quantity Surveying',       'Quantity Surveying',       '#1A1A1A'),
  ('finance',        'כספים',                    'כספים',                'Finance',                  'Pananalapi',               '#2D7A3E'),
  ('site',           'אתר',                      'אתר',                  'Site',                     'Site',                     '#8A7D6B'),
  ('maintenance',    'תחזוקה ותיקונים',          'תחזוקה ותיקונים',     'Maintenance & Repair',     'Pagpapanatili',            '#A32D2D'),
  ('safety',         'בטיחות',                   'בטיחות',               'Safety',                   'Kaligtasan',               '#A32D2D'),
  ('security',       'אבטחה',                    'אבטחה',                'Security',                 'Seguridad',                '#3A3A3A')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name_he = EXCLUDED.name_he,
  name_en = EXCLUDED.name_en,
  name_tl = EXCLUDED.name_tl,
  color = EXCLUDED.color;

-- ─────────────────────────────────────────────────────────────────────────────
-- Projects — real active and pipeline projects (status snapshot as of May 2026)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO op_projects (code, name, status, department_id, notes) VALUES
  -- Active construction
  ('PDF',         'Pearl de Flore (SM San Lazaro)',  'active',    NULL, 'Mall kiosk fit-out, ~90% complete'),
  ('FIXI',        'Fixifoot Grand Westside',          'active',    NULL, 'Hotel-mall retail fit-out, Paranaque, ~90%'),
  ('ICON18H',     'Icon 18H',                         'active',    NULL, 'BGC residential unit renovation, ~90%'),
  ('ICON2H',     'Icon 2H',                          'active',    NULL, 'BGC residential unit renovation'),
  ('4STOREY',     '4-Storey Pampanga',                'active',    NULL, '4-storey residential building, Angeles City'),
  ('TRESOR',      'Tresor Rare (Manila Bay)',         'active',    NULL, 'Ayala Manila Bay mall fit-out, pre-construction'),
  ('BOHOL',       'Bohol — Panglao Prime Villas',     'active',    NULL, 'Blue Everest land development, Dauis Bohol'),
  -- Maintenance / warranty / repair
  ('PULU',        'Pulu Amsic',                       'active',    NULL, 'Post-handover monitoring, electrical, pest control'),
  ('VITALITE',    'Vitalite',                         'active',    NULL, 'Repainting, restoration'),
  ('LCT',         'LCT (Kedma)',                      'active',    NULL, 'Mall renovation + signage'),
  ('JPL',         'JPL — Multi-Clinic Maintenance',   'active',    NULL, 'Monthly maintenance contract, ~14 clinics + 7 kiosks'),
  ('JPLOFC',      'JPL New Office',                   'active',    NULL, 'Office renovation, SPC flooring'),
  ('VILLA9',      'Villa 9 (San Lorenzo Pool)',       'active',    NULL, 'Renovation + electrical works'),
  ('VILLA3',      'Villa 3 (San Lorenzo)',            'active',    NULL, 'Renovation, door restoration'),
  ('DREAM',       'The Dreame',                       'active',    NULL, 'Fit-out'),
  ('AZIZA',       'Aziza',                            'active',    NULL, 'BGC McKinley, renovation/maintenance'),
  ('MELLA',       'Mella',                            'active',    NULL, 'Maintenance'),
  ('VENUS',       'Venus',                            'active',    NULL, 'Fit-out'),
  ('ETON',        'Emanuelle Eton',                   'active',    NULL, 'Renovation'),
  ('RESHAPE',     'Reshape Circuit Makati',           'active',    NULL, 'Fit-out + mirror works'),
  ('FTV',         'FTV / Manila Bay',                 'completed', NULL, 'Completed turnover'),
  ('FILLIT',      'Fill It',                          'active',    NULL, 'Strip light + glass door work'),
  -- Pipeline / design only
  ('BGCSPA',      'BGC Spa',                          'active',    NULL, 'Design phase, 3-floor layout'),
  ('ELLE',        'Elle Iloilo',                      'active',    NULL, 'BOQ + design'),
  ('TRINOMA',     'Trinoma Kiosk',                    'active',    NULL, 'Kiosk design'),
  ('OPATRA',      'Opatra Gensan',                    'active',    NULL, 'Architectural design + rendering'),
  ('FORTLEG',     'Fort Legend Office',               'active',    NULL, 'Architectural design'),
  ('VOUPRE',      'Voupre Gensan',                    'active',    NULL, 'Schematic design'),
  ('L300',        'L300 Vehicle Wrap',                'active',    NULL, 'Sticker design'),
  ('SIQUIJOR',    'Siquijor Geodome',                 'active',    NULL, 'Pre-construction'),
  ('MANBAY',      'Manila Bay (Maor)',                'active',    NULL, 'Pre-construction, separate from Tresor Rare')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes;

-- ─────────────────────────────────────────────────────────────────────────────
-- Employees — core in-house team (admin pre-registers; phones added via UI)
-- WhatsApp phones intentionally left null — populate via /hr/operations/employees
-- ─────────────────────────────────────────────────────────────────────────────

WITH dept_lookup AS (
  SELECT id, code FROM op_departments
)
INSERT INTO op_employees (full_name, role, department_id, is_pm, is_active)
SELECT t.full_name, t.role, d.id, t.is_pm, t.is_active
FROM (VALUES
  -- Management
  ('Bar Gvili',                      'CEO',                                 'admin',        false, true),
  ('Nicx',                            'HR & Office Manager',                 'hr',           false, true),
  ('Marie Cris Millete (MC)',         'Head of Finance and Budget',          'finance',      false, true),
  -- Architecture team
  ('Lawrence Locsin',                 'Senior Architect / Head',             'architecture', false, true),
  ('Shaina Mae Luz',                  'Architect',                           'architecture', false, true),
  ('Aliah Rose Mallari',              'Architect Apprentice',                'architecture', false, true),
  ('Jerwin Angel Tapang',             'Draftsman / Architect Apprentice',    'architecture', false, true),
  -- Project management
  ('Jester R. Molde',                 'Senior Project Manager (Pampanga)',   'projects',     true,  true),
  ('Eric (Enrique Masangkay)',        'Project Manager (Fixifoot)',          'projects',     true,  true),
  ('Mark Lee Bercasio',               'Site Engineer (Icon 18H)',            'projects',     false, true),
  ('Raegan',                          'Project Manager (Icon 18H)',          'projects',     true,  true),
  ('Daff',                            'Project Manager (Pearl de Flore)',    'projects',     true,  true),
  -- QS
  ('Darwin Constantino',              'Quantity Surveyor',                   'qs',           false, true),
  ('Felix Bryan Ramones',             'Quantity Surveyor',                   'qs',           false, true),
  ('Justin',                          'Quantity Surveyor',                   'qs',           false, true),
  -- Procurement
  ('Daniel',                          'Procurement Head',                    'procurement',  false, true),
  ('Kyla Panday',                     'Procurement / Purchasing',            'procurement',  false, true),
  -- Admin / Secretary
  ('Rose Anne Tabuzo',                'Office Secretary',                    'admin',        false, true),
  ('Gee (Angela Bragancia)',          'Secretary / Assistant',               'admin',        false, true),
  -- Warehouse / Maintenance
  ('Christian S. Mendevil',           'Warehouse Manager',                   'site',         false, true),
  ('Ryan Radulle',                    'Repair Team Foreman',                 'maintenance',  false, true),
  ('Jade (Joven Jade Elludar)',       'Repair Team',                         'maintenance',  false, true),
  ('Arnold Cedeno',                   'Repair Team',                         'maintenance',  false, true),
  ('Ronnel Laure',                    'Repair Team',                         'maintenance',  false, true),
  ('Nollie',                          'Repair Team',                         'maintenance',  false, true),
  ('Arnel Serrano',                   'Repair Team',                         'maintenance',  false, true),
  -- Security
  ('SG Albert Cruz Tumang',           'Security Guard',                      'security',     false, true),
  ('SG Lansang (Arnel Salas)',        'Security Guard',                      'security',     false, true)
) AS t(full_name, role, dept_code, is_pm, is_active)
LEFT JOIN dept_lookup d ON d.code = t.dept_code
ON CONFLICT DO NOTHING;
