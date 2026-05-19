import { createAdminClient } from "@/lib/supabase/admin";
import type { ComputedMetrics, ScoreBreakdown, EmployeeRisk, RiskFactor } from "@/types/ai-brain";

// Builds a comprehensive context bundle the AI Brain uses for analysis.
// Aggregates ALL HR data: employees, attendance, performance, training, leave, operations.

interface EmployeeRow {
  id: string;
  full_name: string;
  role?: string;
  department_id?: string;
  project_id?: string;
  is_active?: boolean;
  is_pm?: boolean;
  hire_date?: string;
  employment_type?: string;
  salary_grade?: string;
  department?: { name: string; name_he?: string } | null;
  project?: { name: string } | null;
}

interface AttendanceRow {
  employee_id: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  total_hours?: number;
  overtime_hours?: number;
  status: string;
  employee?: { full_name: string } | null;
}

interface ReviewRow {
  employee_id: string;
  review_date?: string;
  review_period?: string;
  rating?: number;
  status?: string;
  employee?: { full_name: string } | null;
}

interface LeaveRow {
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface LeaveBalanceRow {
  employee_id: string;
  year: number;
  leave_type: string;
  total_days: number;
  used_days: number;
}

interface TrainingRow {
  employee_id: string;
  status: string;
  score?: number;
  course?: { title: string; category?: string; is_mandatory?: boolean } | null;
  employee?: { full_name: string } | null;
}

interface CourseRow {
  id: string;
  title: string;
  category?: string;
  is_mandatory?: boolean;
}

export async function buildHRBrainContext() {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();

  const [
    { data: employees },
    { data: attendance },
    { data: reviews },
    { data: leaveRequests },
    { data: leaveBalances },
    { data: trainEnroll },
    { data: courses },
    { data: departments },
    { data: projects },
    { data: opItems },
    { data: activeInsights },
  ] = await Promise.all([
    supabase.from("op_employees").select("*, department:op_departments(name, name_he), project:op_projects(name)").eq("is_active", true),
    supabase.from("hr_attendance").select("*, employee:op_employees(full_name)").gte("date", thirtyDaysAgo).order("date", { ascending: false }).limit(2000),
    supabase.from("hr_performance_reviews").select("*, employee:op_employees(full_name)").gte("review_date", oneYearAgo).order("review_date", { ascending: false }).limit(500),
    supabase.from("hr_leave_requests").select("*").gte("start_date", ninetyDaysAgo).order("start_date", { ascending: false }).limit(500),
    supabase.from("hr_leave_balances").select("*").eq("year", currentYear),
    supabase.from("hr_training_enrollments").select("*, course:hr_training_courses(title, category, is_mandatory), employee:op_employees(full_name)").limit(500),
    supabase.from("hr_training_courses").select("*"),
    supabase.from("op_departments").select("id, name, name_he, code"),
    supabase.from("op_projects").select("id, name, status, code"),
    supabase.from("op_report_items").select("id, issue, status, priority, deadline, department_id, project_id, person_responsible_raw").gte("report_date", thirtyDaysAgo).limit(300),
    supabase.from("hr_brain_insights").select("id, type, title, status").eq("status", "active").limit(50),
  ]);

  const emps = (employees || []) as EmployeeRow[];
  const att = (attendance || []) as AttendanceRow[];
  const revs = (reviews || []) as ReviewRow[];
  const leaves = (leaveRequests || []) as LeaveRow[];
  const balances = (leaveBalances || []) as LeaveBalanceRow[];
  const enrollments = (trainEnroll || []) as TrainingRow[];
  const allCourses = (courses || []) as CourseRow[];
  const depts = departments || [];
  const projs = projects || [];
  const items = opItems || [];
  const existingInsights = activeInsights || [];

  // ── Compute metrics ─────────────────────────────────────────────────────

  // Attendance metrics
  const totalAttDays = att.length;
  const presentDays = att.filter(a => a.status === "present" || a.status === "half_day").length;
  const lateDays = att.filter(a => a.status === "late").length;
  const absentDays = att.filter(a => a.status === "absent").length;
  const attendanceRate = totalAttDays > 0 ? (presentDays + lateDays) / totalAttDays * 100 : 100;

  // Attendance by employee
  const attByEmp: Record<string, { absent: number; late: number; total: number }> = {};
  for (const a of att) {
    if (!attByEmp[a.employee_id]) attByEmp[a.employee_id] = { absent: 0, late: 0, total: 0 };
    attByEmp[a.employee_id].total++;
    if (a.status === "absent") attByEmp[a.employee_id].absent++;
    if (a.status === "late") attByEmp[a.employee_id].late++;
  }
  const frequentAbsentees = Object.entries(attByEmp)
    .filter(([, v]) => v.absent >= 3 || v.late >= 5)
    .map(([id, v]) => ({ id, ...v }));

  // Attendance by department
  const attByDept: Record<string, { present: number; total: number }> = {};
  for (const a of att) {
    const emp = emps.find(e => e.id === a.employee_id);
    const deptId = emp?.department_id || "unknown";
    if (!attByDept[deptId]) attByDept[deptId] = { present: 0, total: 0 };
    attByDept[deptId].total++;
    if (a.status !== "absent") attByDept[deptId].present++;
  }

  // Attendance trend by day
  const attByDate: Record<string, { present: number; total: number }> = {};
  for (const a of att) {
    if (!attByDate[a.date]) attByDate[a.date] = { present: 0, total: 0 };
    attByDate[a.date].total++;
    if (a.status !== "absent") attByDate[a.date].present++;
  }
  const attendanceTrend = Object.entries(attByDate)
    .map(([date, v]) => ({ date, rate: v.total > 0 ? Math.round(v.present / v.total * 100) : 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Overtime trend by day
  const otByDate: Record<string, number> = {};
  for (const a of att) {
    if (a.overtime_hours && a.overtime_hours > 0) {
      otByDate[a.date] = (otByDate[a.date] || 0) + a.overtime_hours;
    }
  }
  const overtimeTrend = Object.entries(otByDate)
    .map(([date, hours]) => ({ date, hours }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Performance metrics
  const completedReviews = revs.filter(r => r.rating != null && r.rating > 0);
  const avgPerformance = completedReviews.length > 0
    ? completedReviews.reduce((s, r) => s + (r.rating || 0), 0) / completedReviews.length
    : 0;
  const lowPerformers = completedReviews.filter(r => (r.rating || 0) < 2.5);

  // Training compliance
  const mandatoryCourses = allCourses.filter(c => c.is_mandatory);
  const mandatoryCount = mandatoryCourses.length * emps.length;
  const completedMandatory = enrollments.filter(e => {
    const course = allCourses.find(c => c.id === (e.course as unknown as { id?: string })?.id);
    return course?.is_mandatory && e.status === "completed";
  }).length;
  const trainingCompliance = mandatoryCount > 0 ? completedMandatory / mandatoryCount * 100 : 100;

  // Leave health
  const sickLeaves = leaves.filter(l => l.leave_type === "sick" && l.status === "approved");
  const leaveHealthScore = emps.length > 0
    ? Math.max(0, 100 - (sickLeaves.length / emps.length) * 20)
    : 100;

  // Operations health
  const openItems = items.filter(i => i.status !== "resolved");
  const overdueItems = openItems.filter(i => i.deadline && i.deadline < today);
  const opsHealth = openItems.length > 0
    ? Math.max(0, 100 - (overdueItems.length / openItems.length) * 100)
    : 100;

  // ── Employee Risk Scoring ───────────────────────────────────────────────

  const employeeRisks: EmployeeRisk[] = [];
  for (const emp of emps) {
    const factors: RiskFactor[] = [];
    let riskScore = 0;

    // Frequent absence
    const empAtt = attByEmp[emp.id];
    if (empAtt && (empAtt.absent >= 3 || empAtt.late >= 5)) {
      factors.push("frequent_absence");
      riskScore += 25;
    }

    // Low performance
    const empReviews = completedReviews.filter(r => r.employee_id === emp.id);
    const latestReview = empReviews[0];
    if (latestReview && (latestReview.rating || 0) < 2.5) {
      factors.push("low_performance");
      riskScore += 30;
    }

    // Overdue review (no review in past year)
    if (empReviews.length === 0 && emp.hire_date && emp.hire_date < oneYearAgo) {
      factors.push("overdue_review");
      riskScore += 15;
    }

    // Incomplete mandatory training
    const empEnrollments = enrollments.filter(e => e.employee_id === emp.id);
    const completedCourseIds = empEnrollments.filter(e => e.status === "completed").map(e => (e.course as unknown as { id?: string })?.id);
    const missingMandatory = mandatoryCourses.filter(c => !completedCourseIds.includes(c.id));
    if (missingMandatory.length > 0) {
      factors.push("incomplete_training");
      riskScore += 15;
    }

    // High leave usage
    const empBalance = balances.filter(b => b.employee_id === emp.id);
    const totalUsed = empBalance.reduce((s, b) => s + b.used_days, 0);
    const totalAvail = empBalance.reduce((s, b) => s + b.total_days, 0);
    if (totalAvail > 0 && totalUsed / totalAvail > 0.8) {
      factors.push("high_leave_usage");
      riskScore += 15;
    }

    if (factors.length > 0) {
      const deptName = (emp.department as { name: string } | null)?.name || "Unknown";
      employeeRisks.push({
        employee_id: emp.id,
        full_name: emp.full_name,
        department_name: deptName,
        risk_score: Math.min(100, riskScore),
        risk_factors: factors,
      });
    }
  }
  employeeRisks.sort((a, b) => b.risk_score - a.risk_score);

  // ── Department Scores ───────────────────────────────────────────────────

  const deptScores = depts.map(d => {
    const deptEmps = emps.filter(e => e.department_id === d.id);
    const deptEmpIds = deptEmps.map(e => e.id);

    // Attendance
    const deptAtt = attByDept[d.id] || { present: 0, total: 0 };
    const deptAttRate = deptAtt.total > 0 ? deptAtt.present / deptAtt.total * 100 : 100;

    // Performance
    const deptRevs = completedReviews.filter(r => deptEmpIds.includes(r.employee_id));
    const deptPerf = deptRevs.length > 0
      ? deptRevs.reduce((s, r) => s + (r.rating || 0), 0) / deptRevs.length
      : 3; // neutral default

    // Training
    const deptEnroll = enrollments.filter(e => deptEmpIds.includes(e.employee_id));
    const deptCompleted = deptEnroll.filter(e => e.status === "completed").length;
    const deptTrain = deptEnroll.length > 0 ? deptCompleted / deptEnroll.length * 100 : 100;

    // Leave
    const deptBal = balances.filter(b => deptEmpIds.includes(b.employee_id));
    const deptUsed = deptBal.reduce((s, b) => s + b.used_days, 0);
    const deptAvail = deptBal.reduce((s, b) => s + b.total_days, 0);
    const deptLeave = deptAvail > 0 ? Math.max(0, 100 - (deptUsed / deptAvail) * 100) : 100;

    // Ops
    const deptItems = items.filter(i => i.department_id === d.id && i.status !== "resolved");
    const deptOverdue = deptItems.filter(i => i.deadline && i.deadline < today);
    const deptOps = deptItems.length > 0 ? Math.max(0, 100 - (deptOverdue.length / deptItems.length) * 100) : 100;

    const breakdown: ScoreBreakdown = {
      attendance: Math.round(deptAttRate),
      performance: Math.round(deptPerf / 5 * 100),
      training: Math.round(deptTrain),
      leave_health: Math.round(deptLeave),
      operations: Math.round(deptOps),
    };
    const score = Math.round(
      breakdown.attendance * 0.25 +
      breakdown.performance * 0.25 +
      breakdown.training * 0.20 +
      breakdown.leave_health * 0.15 +
      breakdown.operations * 0.15
    );

    return { id: d.id, name: d.name, score, breakdown };
  });

  // ── Company Health Score ────────────────────────────────────────────────

  const companyBreakdown: ScoreBreakdown = {
    attendance: Math.round(attendanceRate),
    performance: Math.round(avgPerformance / 5 * 100),
    training: Math.round(trainingCompliance),
    leave_health: Math.round(leaveHealthScore),
    operations: Math.round(opsHealth),
  };
  const companyHealth = Math.round(
    companyBreakdown.attendance * 0.25 +
    companyBreakdown.performance * 0.25 +
    companyBreakdown.training * 0.20 +
    companyBreakdown.leave_health * 0.15 +
    companyBreakdown.operations * 0.15
  );

  // ── Build text context for Claude ───────────────────────────────────────

  const lines: string[] = [];
  lines.push(`COMPANY HR SNAPSHOT (as of ${new Date().toISOString()})`);
  lines.push(`- Total active employees: ${emps.length}`);
  lines.push(`- Departments: ${depts.length}  Projects: ${projs.filter(p => p.status === "active").length} active`);
  lines.push(`- Company Health Score: ${companyHealth}/100`);
  lines.push(`  Attendance: ${companyBreakdown.attendance}% | Performance: ${companyBreakdown.performance}% | Training: ${companyBreakdown.training}% | Leave Health: ${companyBreakdown.leave_health}% | Ops: ${companyBreakdown.operations}%`);
  lines.push("");

  lines.push("DEPARTMENT BREAKDOWN:");
  for (const ds of deptScores) {
    lines.push(`- ${ds.name}: Score ${ds.score}/100 (Att: ${ds.breakdown.attendance}% Perf: ${ds.breakdown.performance}% Train: ${ds.breakdown.training}% Leave: ${ds.breakdown.leave_health}% Ops: ${ds.breakdown.operations}%)`);
  }
  lines.push("");

  lines.push(`EMPLOYEES (${emps.length}):`);
  for (const e of emps.slice(0, 80)) {
    const dept = (e.department as { name: string } | null)?.name || "?";
    const proj = (e.project as { name: string } | null)?.name || "?";
    lines.push(`- ${e.full_name} | ${e.role || "?"} | ${dept} | ${proj} | ${e.employment_type || "?"} | hired ${e.hire_date || "?"}`);
  }
  lines.push("");

  if (frequentAbsentees.length > 0) {
    lines.push("ATTENDANCE RISK FLAGS:");
    for (const fa of frequentAbsentees) {
      const emp = emps.find(e => e.id === fa.id);
      lines.push(`- ${emp?.full_name || fa.id}: ${fa.absent} absences, ${fa.late} late in 30 days (out of ${fa.total} records)`);
    }
    lines.push("");
  }

  lines.push(`ATTENDANCE SUMMARY (30d): ${totalAttDays} records | Present: ${presentDays} | Late: ${lateDays} | Absent: ${absentDays} | Rate: ${attendanceRate.toFixed(1)}%`);
  lines.push("");

  if (completedReviews.length > 0) {
    lines.push(`PERFORMANCE REVIEWS (12 months): ${completedReviews.length} completed | Avg score: ${avgPerformance.toFixed(1)}/5`);
    if (lowPerformers.length > 0) {
      lines.push("  Low performers (<2.5):");
      for (const lp of lowPerformers) {
        const emp = emps.find(e => e.id === lp.employee_id);
        lines.push(`  - ${emp?.full_name || lp.employee_id}: ${lp.rating}/5 (${lp.review_period || lp.review_date})`);
      }
    }
    lines.push("");
  }

  lines.push(`TRAINING: ${allCourses.length} courses (${mandatoryCourses.length} mandatory) | ${enrollments.length} enrollments | Compliance: ${trainingCompliance.toFixed(0)}%`);
  lines.push("");

  if (leaves.length > 0) {
    const leaveByType: Record<string, number> = {};
    for (const l of leaves.filter(lr => lr.status === "approved")) {
      leaveByType[l.leave_type] = (leaveByType[l.leave_type] || 0) + 1;
    }
    lines.push(`LEAVE (90d): ${leaves.length} requests | By type: ${Object.entries(leaveByType).map(([k, v]) => `${k}:${v}`).join(", ")}`);
    lines.push("");
  }

  if (openItems.length > 0) {
    lines.push(`OPERATIONS (30d): ${openItems.length} open items | ${overdueItems.length} overdue | ${items.filter(i => i.priority === "urgent").length} urgent`);
    lines.push("");
  }

  if (employeeRisks.length > 0) {
    lines.push(`EMPLOYEE RISK RADAR (${employeeRisks.length} flagged):`);
    for (const er of employeeRisks.slice(0, 20)) {
      lines.push(`- ${er.full_name} (${er.department_name}): Score ${er.risk_score} — ${er.risk_factors.join(", ")}`);
    }
    lines.push("");
  }

  if (existingInsights.length > 0) {
    lines.push(`EXISTING ACTIVE INSIGHTS (${existingInsights.length}) — avoid generating duplicates:`);
    for (const ins of existingInsights) {
      lines.push(`- [${ins.type}] ${ins.title}`);
    }
    lines.push("");
  }

  const metrics: ComputedMetrics = {
    company_health: companyHealth,
    attendance_rate: Math.round(attendanceRate),
    training_compliance: Math.round(trainingCompliance),
    avg_performance: Math.round(avgPerformance * 10) / 10,
    active_insights_count: existingInsights.length,
    critical_count: 0, // Will be filled from DB query on caller side
    at_risk_count: employeeRisks.length,
    department_scores: deptScores,
    employee_risks: employeeRisks,
    trends: {
      attendance_30d: attendanceTrend,
      overtime_30d: overtimeTrend,
    },
  };

  return {
    text: lines.join("\n"),
    metrics,
    companyBreakdown,
    deptScores,
  };
}
