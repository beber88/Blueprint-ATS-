/**
 * Drive File Classifier — determines target table and document type
 * based on the Drive folder path. No AI needed for most files since
 * the folder structure IS the classification.
 */

export interface Classification {
  target_table: string | null;
  document_type: string | null;
  category: string;         // top-level: admin, finance, hr, projects, procurement, applicant
  skip: boolean;            // true for templates/forms folders we don't import
  needs_employee_match: boolean;
  needs_project_match: boolean;
}

const SKIP_FOLDERS = new Set([
  "forms", "draft", "pictogram", "signature", "signatory",
]);

/**
 * Classify a Drive file based on its full folder path.
 * Path format: "Admin/Employee/Engineer/Jester/contract.pdf"
 */
export function classifyByPath(drivePath: string): Classification {
  const parts = drivePath.split("/").map((p) => p.toLowerCase().trim());
  const root = parts[0] || "";

  // Default
  const result: Classification = {
    target_table: null,
    document_type: null,
    category: root,
    skip: false,
    needs_employee_match: false,
    needs_project_match: false,
  };

  // Skip template/asset folders
  if (parts.some((p) => SKIP_FOLDERS.has(p))) {
    result.skip = true;
    return result;
  }

  // ─── Admin ─────────────────────────────────────────────────────
  if (root === "admin") {
    if (parts[1] === "employee") {
      result.target_table = "hr_employee_documents";
      result.needs_employee_match = true;
      // parts[2] = department (engineer, architect, admin, head, repair, offboarded, night nurse)
      // parts[3] = employee name (if exists)
      result.document_type = guessDocType(drivePath);
      return result;
    }
    if (parts[1] === "training") {
      result.target_table = "hr_employee_documents";
      result.document_type = "certificate";
      result.needs_employee_match = true;
      return result;
    }
    if (parts[1] === "to onboard") {
      result.target_table = "hr_employee_documents";
      result.document_type = "contract";
      result.needs_employee_match = true;
      return result;
    }
    if (parts[1] === "pending") {
      result.target_table = "hr_employee_documents";
      result.document_type = "other";
      result.needs_employee_match = true;
      return result;
    }
    if (parts[1] === "files") {
      result.target_table = "hr_employee_documents";
      result.document_type = "other";
      return result;
    }
    // Proposal, Draft, Pictogram — skip
    result.skip = true;
    return result;
  }

  // ─── Finance ───────────────────────────────────────────────────
  if (root === "finance") {
    if (parts[1] === "payroll") {
      result.target_table = "hr_payslips";
      result.needs_employee_match = true;
      return result;
    }
    if (parts[1] === "government benefits") {
      result.target_table = "hr_employee_documents";
      result.document_type = "government";
      result.needs_employee_match = true;
      return result;
    }
    if (parts[1] === "dtr") {
      result.target_table = "hr_attendance";
      result.document_type = "dtr";
      result.needs_employee_match = true;
      return result;
    }
    if (parts[1] === "adjustment") {
      result.target_table = "hr_salary";
      result.needs_employee_match = true;
      return result;
    }
    if (parts[1] === "reimbursment" || parts[1] === "reimbursement") {
      result.target_table = "hr_employee_documents";
      result.document_type = "other";
      result.needs_employee_match = true;
      return result;
    }
    if (parts[1] === "credit card subscription") {
      result.target_table = "hr_employee_documents";
      result.document_type = "other";
      return result;
    }
    // Forms — skip
    result.skip = true;
    return result;
  }

  // ─── HR ────────────────────────────────────────────────────────
  if (root === "hr") {
    if (parts[1] === "daily report") {
      result.target_table = "op_reports";
      return result;
    }
    if (parts[1] === "employee assessment and evaluation") {
      result.target_table = "hr_performance_reviews";
      result.needs_employee_match = true;
      return result;
    }
    if (parts[1] === "released memorandum") {
      result.target_table = "hr_employee_documents";
      result.document_type = "memo";
      return result;
    }
    if (parts[1] === "company policy") {
      result.target_table = "hr_employee_documents";
      result.document_type = "other";
      return result;
    }
    if (parts[1] === "promotion attachment") {
      result.target_table = "hr_employee_documents";
      result.document_type = "other";
      result.needs_employee_match = true;
      return result;
    }
    if (parts[1] === "offboarding") {
      result.target_table = "hr_employee_documents";
      result.document_type = "other";
      result.needs_employee_match = true;
      return result;
    }
    if (parts[1] === "onboarding") {
      result.target_table = "hr_employee_documents";
      result.document_type = "contract";
      result.needs_employee_match = true;
      return result;
    }
    if (parts[1] === "sanctions") {
      result.target_table = "hr_employee_documents";
      result.document_type = "memo";
      result.needs_employee_match = true;
      return result;
    }
    result.skip = true;
    return result;
  }

  // ─── Projects ──────────────────────────────────────────────────
  if (root === "projects") {
    // Spreadsheet files at root level (Project Directory.xlsx etc.) — skip
    if (parts.length <= 2 && drivePath.match(/\.(xlsx|csv)$/i)) {
      result.skip = true;
      return result;
    }
    result.target_table = "hr_employee_documents"; // project docs
    result.document_type = "other";
    result.needs_project_match = true;
    return result;
  }

  // ─── Procurement ───────────────────────────────────────────────
  if (root === "procurement") {
    result.target_table = "hr_employee_documents";
    result.document_type = "other";
    return result;
  }

  // ─── Applicant ─────────────────────────────────────────────────
  if (root === "applicant") {
    result.target_table = "candidates"; // recruitment module
    return result;
  }

  return result;
}

/** Guess document type from file name */
function guessDocType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.includes("contract") || lower.includes("agreement")) return "contract";
  if (lower.includes("id") || lower.includes("sss") || lower.includes("philhealth") || lower.includes("pagibig") || lower.includes("tin")) return "id";
  if (lower.includes("certificate") || lower.includes("cert")) return "certificate";
  if (lower.includes("memo")) return "memo";
  if (lower.includes("resume") || lower.includes("cv")) return "other";
  if (lower.includes("evaluation") || lower.includes("assessment")) return "evaluation";
  if (lower.includes("medical") || lower.includes("health")) return "medical";
  return "other";
}
