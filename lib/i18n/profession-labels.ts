const PROFESSION_MAP: Record<string, Record<string, string>> = {
  architect_licensed: { he: "אדריכל מורשה", en: "Licensed Architect", tl: "Lisensyadong Arkitekto" },
  architect: { he: "אדריכל", en: "Architect", tl: "Arkitekto" },
  architect_intern: { he: "אדריכל מתמחה", en: "Architect Intern", tl: "Intern na Arkitekto" },
  draftsman: { he: "שרטט", en: "Draftsman", tl: "Draftsman" },
  project_manager: { he: "מנהל פרויקט", en: "Project Manager", tl: "Project Manager" },
  site_engineer: { he: "מהנדס אתר", en: "Site Engineer", tl: "Site Engineer" },
  engineer_civil: { he: "מהנדס אזרחי", en: "Civil Engineer", tl: "Civil Engineer" },
  civil_engineer: { he: "מהנדס אזרחי", en: "Civil Engineer", tl: "Civil Engineer" },
  engineer_structural: { he: "מהנדס קונסטרוקציה", en: "Structural Engineer", tl: "Structural Engineer" },
  engineer_mep: { he: "מהנדס מערכות", en: "MEP Engineer", tl: "MEP Engineer" },
  engineer_electrical: { he: "מהנדס חשמל", en: "Electrical Engineer", tl: "Electrical Engineer" },
  electrical_engineer: { he: "מהנדס חשמל", en: "Electrical Engineer", tl: "Electrical Engineer" },
  engineer_mechanical: { he: "מהנדס מכונות", en: "Mechanical Engineer", tl: "Mechanical Engineer" },
  mechanical_engineer: { he: "מהנדס מכונות", en: "Mechanical Engineer", tl: "Mechanical Engineer" },
  quantity_surveyor: { he: "מודד כמויות", en: "Quantity Surveyor", tl: "Quantity Surveyor" },
  finance: { he: "כספים", en: "Finance", tl: "Finance" },
  finance_accountant: { he: "רואה חשבון", en: "Accountant", tl: "Accountant" },
  hr: { he: "משאבי אנוש", en: "HR", tl: "HR" },
  secretary: { he: "מזכירות", en: "Secretary", tl: "Secretary" },
  procurement: { he: "רכש", en: "Procurement", tl: "Procurement" },
  marketing: { he: "שיווק", en: "Marketing", tl: "Marketing" },
  foreman: { he: "מנהל עבודה", en: "Foreman", tl: "Foreman" },
  supervisor: { he: "מפקח", en: "Supervisor", tl: "Supervisor" },
  construction_worker: { he: "עובד בניין", en: "Construction Worker", tl: "Construction Worker" },
  qc_inspector: { he: "מפקח איכות", en: "QC Inspector", tl: "QC Inspector" },
  hse_officer: { he: "קצין בטיחות", en: "HSE Officer", tl: "HSE Officer" },
  document_controller: { he: "בקר מסמכים", en: "Document Controller", tl: "Document Controller" },
  admin: { he: "מנהלה", en: "Admin", tl: "Admin" },
  it: { he: "מערכות מידע", en: "IT", tl: "IT" },
  other: { he: "אחר", en: "Other", tl: "Iba pa" },
  unclassified: { he: "לא סווג", en: "Unclassified", tl: "Hindi na-classify" },
};

export function getProfessionLabel(profession: string | null | undefined, lang: string): string {
  if (!profession) {
    return lang === "he" ? "לא סווג עדיין" : lang === "tl" ? "Hindi pa na-classify" : "Not classified";
  }

  // Direct match
  if (PROFESSION_MAP[profession]?.[lang]) return PROFESSION_MAP[profession][lang];

  // Lowercase + underscore
  const lower = profession.toLowerCase().replace(/\s+/g, "_");
  if (PROFESSION_MAP[lower]?.[lang]) return PROFESSION_MAP[lower][lang];

  // Remove prefix if leaked
  const cleaned = profession.replace("job_categories.", "");
  if (PROFESSION_MAP[cleaned]?.[lang]) return PROFESSION_MAP[cleaned][lang];

  // Fallback: format nicely
  return profession.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
