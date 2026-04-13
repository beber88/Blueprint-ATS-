"use client";

import { useI18n } from "@/lib/i18n/context";
import { useState } from "react";
import {
  Upload, Users, Briefcase, MessageSquare, MessageCircle, BarChart3,
  Settings, Search, ChevronDown, ChevronRight, Lightbulb, FolderOpen, BookOpen,
} from "lucide-react";

interface GuideSection {
  icon: React.ReactNode;
  titleKey: string;
  content: Record<string, string[]>;
}

const sections: GuideSection[] = [
  {
    icon: <BookOpen className="h-5 w-5" />,
    titleKey: "guide.getting_started",
    content: {
      he: [
        "גישה למערכת: כנסו לכתובת blueprint-ats.vercel.app והזינו אימייל וסיסמה",
        "החלפת שפה: בתחתית הסרגל הצדי לחצו על HE / EN / TL",
        "מצב כהה/בהיר: כפתור שמש/ירח בתחתית הסרגל הצדי",
        "הסרגל הצדי מחולק ל-4 קבוצות: ראשי (דשבורד, מועמדים, משרות, ראיונות), תקשורת (צ'אט, הודעות, תבניות), כלים (עוזר AI, מקצועות, מדריך), ניהול (קבצים, הגדרות, משתמשים)",
      ],
      en: [
        "Access: Go to blueprint-ats.vercel.app and enter your email and password",
        "Change language: Click HE / EN / TL at the bottom of the sidebar",
        "Dark/Light mode: Sun/Moon button at the bottom of the sidebar",
        "Sidebar is organized in 4 groups: Main (Dashboard, Candidates, Jobs, Interviews), Communication (Chat, Messages, Templates), Tools (AI Assistant, Professions, Guide), Management (Files, Settings, Users)",
      ],
      tl: [
        "Access: Pumunta sa blueprint-ats.vercel.app at ilagay ang email at password",
        "Palitan ang wika: I-click ang HE / EN / TL sa ibaba ng sidebar",
        "Dark/Light mode: Sun/Moon button sa ibaba ng sidebar",
        "Ang sidebar ay naka-organize sa 4 na grupo: Main, Communication, Tools, Management",
      ],
    },
  },
  {
    icon: <Upload className="h-5 w-5" />,
    titleKey: "guide.uploading_files",
    content: {
      he: [
        "לחצו על 'העלה קורות חיים' בדף המועמדים או גררו קבצים לאזור ההעלאה",
        "ניתן להעלות מספר קבצים בו-זמנית או תיקייה שלמה",
        "פורמטים נתמכים: PDF, DOCX — עד 50MB לקובץ",
        "המערכת מעבדת קובץ אחד בכל פעם עם סרגל התקדמות",
        "AI מזהה אוטומטית: קורות חיים, תיק עבודות, תעודה, מכתב המלצה",
        "טיפ: תנו שמות ברורים לקבצים (למשל David_Cohen_CV.pdf)",
        "טיפ: העלו קורות חיים ראשון ואז תיק עבודות, כך שהמיתאם יעבוד",
      ],
      en: [
        "Click 'Upload Files' on the Candidates page or drag files into the upload zone",
        "Upload multiple files at once or an entire folder",
        "Supported formats: PDF, DOCX — up to 50MB per file",
        "System processes one file at a time with a progress bar",
        "AI automatically detects: CV, Portfolio, Certificate, Reference Letter",
        "Tip: Name files clearly (e.g. 'John_Doe_CV.pdf')",
        "Tip: Upload CV first, then portfolio, so matching works correctly",
      ],
      tl: [
        "I-click ang 'Upload Files' sa Candidates page o i-drag ang mga file",
        "Maaaring mag-upload ng maraming file o buong folder",
        "Format: PDF, DOCX — hanggang 50MB bawat file",
        "Awtomatikong tinutukoy ng AI ang uri ng dokumento",
      ],
    },
  },
  {
    icon: <Users className="h-5 w-5" />,
    titleKey: "guide.managing_candidates",
    content: {
      he: [
        "טבלת מועמדים: חיפוש, סינון לפי סטטוס, מקצוע וציון AI",
        "לחיצה על שם פותחת תיק אישי עם 5 טאבים: סקירה, קבצים, ניתוח AI, תקשורת, פעילות",
        "שינוי סטטוס: dropdown בדף המועמד או בטבלה",
        "הוספת הערות: שדה שנשמר אוטומטית",
        "מחיקת מועמד: כפתור אדום — למנהל בלבד",
        "פעולות בכמות: סמנו checkbox — שנו סטטוס, שלחו אימייל, או מחקו",
      ],
      en: [
        "Candidates table: search, filter by status, profession, AI score",
        "Click a name to open personal folder with 5 tabs: Overview, Files, AI Analysis, Communication, Activity",
        "Change status: dropdown on candidate page or table",
        "Add notes: auto-saving notes field",
        "Delete candidate: red button — Admin only",
        "Bulk actions: select checkbox — change status, send email, or delete",
      ],
      tl: [
        "Talaan ng kandidato: maghanap, i-filter ayon sa status, propesyon, AI score",
        "I-click ang pangalan para buksan ang personal folder na may 5 tab",
        "Palitan ang status: dropdown sa candidate page o sa table",
        "Burahin ang kandidato: pula na button — Admin lang",
      ],
    },
  },
  {
    icon: <FolderOpen className="h-5 w-5" />,
    titleKey: "guide.profession_management",
    content: {
      he: [
        "כל מועמד מסווג אוטומטית למקצוע (או ידנית)",
        "דף ניתוח מקצועות מציג את כל המקצועות עם סטטיסטיקות",
        "לחצו על כרטיס מקצוע לראות מועמדים, כישורים וסטטוסים",
        "סיווג אוטומטי: כפתור שמסווג מועמדים ללא סיווג באמצעות AI",
        "מקצועות: אדריכל, מהנדס אזרחי, מנהל פרויקט, מהנדס אתר, מודד כמויות ועוד",
      ],
      en: [
        "Every candidate is classified by profession (auto or manual)",
        "Profession Analysis page shows all professions with stats",
        "Click a profession card to see candidates, skills, and statuses",
        "Auto-classify: button classifies unclassified candidates using AI",
        "Professions: Architect, Civil Engineer, Project Manager, Site Engineer, Quantity Surveyor, etc.",
      ],
      tl: [
        "Bawat kandidato ay na-classify ayon sa propesyon (auto o manual)",
        "Ipinapakita ng Profession Analysis page ang lahat ng propesyon na may stats",
        "I-click ang profession card para makita ang mga kandidato",
      ],
    },
  },
  {
    icon: <MessageCircle className="h-5 w-5" />,
    titleKey: "guide.team_chat",
    content: {
      he: [
        "גישה מהסרגל הצדי: 'צ'אט'",
        "התחלת צ'אט: לחצו '+ צ'אט חדש', בחרו חבר צוות",
        "שליחת הודעה: הקלידו ולחצו Enter (Shift+Enter לשורה חדשה)",
        "Badge זהב: מספר הודעות שלא נקראו מופיע ליד 'צ'אט' בסרגל",
      ],
      en: [
        "Access from sidebar: 'Chat'",
        "Start a chat: click '+ New Chat', select a team member",
        "Send messages: type and press Enter (Shift+Enter for new line)",
        "Gold badge: unread count appears next to 'Chat' in sidebar",
      ],
      tl: [
        "Access mula sa sidebar: 'Chat'",
        "Magsimula ng chat: i-click '+ New Chat', pumili ng team member",
        "Magpadala: mag-type at pindutin ang Enter",
      ],
    },
  },
  {
    icon: <MessageSquare className="h-5 w-5" />,
    titleKey: "guide.communication",
    content: {
      he: [
        "שליחת אימייל: מדף המועמד או דף ההודעות, דרך Gmail",
        "שליחת WhatsApp: מדף המועמד, דרך Twilio",
        "תבניות: הודעות מוכנות — זימון ראיון, דחייה, מעבר לשלב, הצעת עבודה",
        "משתנים אוטומטיים: שם מועמד, כותרת משרה, תאריכים",
      ],
      en: [
        "Send Email: from candidate page or Messages page, via Gmail",
        "Send WhatsApp: from candidate page, via Twilio",
        "Templates: pre-made — Interview Invite, Rejection, Next Stage, Job Offer",
        "Auto-fill variables: candidate name, job title, dates",
      ],
      tl: [
        "Magpadala ng Email: mula sa candidate page, sa pamamagitan ng Gmail",
        "Magpadala ng WhatsApp: sa pamamagitan ng Twilio",
        "Templates: mga handa nang mensahe",
      ],
    },
  },
  {
    icon: <Briefcase className="h-5 w-5" />,
    titleKey: "guide.jobs_interviews",
    content: {
      he: [
        "דף משרות: יצירה, עריכה, הפעלה/השהיה/סגירה",
        "כל משרה מציגה מועמדים מקושרים וציונים",
        "ראיונות: קביעה מדף המועמד או דף הראיונות",
        "הוספת הערות ותוצאות לאחר הראיון",
      ],
      en: [
        "Jobs page: create, edit, activate/pause/close",
        "Each job shows linked candidates and scores",
        "Interviews: schedule from candidate page or Interviews page",
        "Add notes and outcomes after interview",
      ],
      tl: [
        "Jobs page: gumawa, i-edit, i-activate/pause/close",
        "Mga Panayam: mag-iskedyul mula sa candidate page",
      ],
    },
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    titleKey: "guide.dashboard_section",
    content: {
      he: [
        "כרטיסי סטטיסטיקה: מועמדים, חדשים, משרות, ראיונות, אישורים",
        "גרפים: חלוקה לפי מקצוע, Pipeline סטטוסים, התפלגות ציונים",
        "TOP 5 מועמדים עם ציון גבוה",
        "התראות: מועמדים ללא סיווג או ניתוח AI",
      ],
      en: [
        "Stats cards: candidates, new this week, jobs, interviews, approvals",
        "Charts: profession distribution, status pipeline, score distribution",
        "TOP 5 highest scoring candidates",
        "Alerts: unclassified or unanalyzed candidates",
      ],
      tl: [
        "Stats cards: kandidato, bago ngayong linggo, trabaho, panayam",
        "Mga tsart: distribusyon ng propesyon, pipeline ng status",
        "TOP 5 na may pinakamataas na score",
      ],
    },
  },
  {
    icon: <Settings className="h-5 w-5" />,
    titleKey: "guide.settings_section",
    content: {
      he: [
        "אינטגרציות: Gmail ו-WhatsApp",
        "שפה: עברית / English / Tagalog",
        "ניהול משתמשים: הוספה, שינוי תפקיד, הסרה (למנהל בלבד)",
        "תפקידים: מנהל (גישה מלאה), מגייס (ללא מחיקה), צופה (קריאה בלבד)",
      ],
      en: [
        "Integrations: Gmail and WhatsApp",
        "Language: Hebrew / English / Tagalog",
        "User management: add, change role, remove (Admin only)",
        "Roles: Admin (full), Recruiter (no delete), Viewer (read only)",
      ],
      tl: [
        "Integrations: Gmail at WhatsApp",
        "Wika: Hebrew / English / Tagalog",
        "Pamamahala ng user (Admin lang)",
      ],
    },
  },
  {
    icon: <Lightbulb className="h-5 w-5" />,
    titleKey: "guide.tips",
    content: {
      he: [
        "העלו CV כ-PDF לתוצאות מיטביות",
        "תנו שמות ברורים לקבצים עם שם המועמד",
        "העלו CV ראשון, תיק עבודות שני",
        "הפעילו סיווג אוטומטי באופן קבוע",
        "שתפו ניתוחי AI בצ'אט במקום להריץ שוב",
        "עדכנו סטטוס אחרי כל פעולה",
        "בדקו דשבורד יומית",
      ],
      en: [
        "Upload CVs as PDF for best results",
        "Name files with candidate name and document type",
        "Upload CV first, portfolio second",
        "Use auto-classify regularly",
        "Share AI analyses in chat instead of redoing",
        "Update status after every action",
        "Check Dashboard daily",
      ],
      tl: [
        "Mag-upload ng CV bilang PDF",
        "Pangalanan ang mga file gamit ang pangalan ng kandidato",
        "Mag-upload muna ng CV, pagkatapos portfolio",
        "Gamitin ang auto-classify nang regular",
        "Suriin ang Dashboard araw-araw",
      ],
    },
  },
];

export default function GuidePage() {
  const { t, locale } = useI18n();
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]));
  const [searchQuery, setSearchQuery] = useState("");

  const toggleSection = (idx: number) => {
    setOpenSections(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const filteredSections = searchQuery
    ? sections.filter(s => {
        const title = t(s.titleKey).toLowerCase();
        const content = (s.content[locale] || s.content.en || []).join(" ").toLowerCase();
        return title.includes(searchQuery.toLowerCase()) || content.includes(searchQuery.toLowerCase());
      })
    : sections;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-primary)" }}>
        <div className="px-8 py-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{t("guide.title")}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>Blueprint Building Group Inc.</p>
        </div>
      </div>

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-3">
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t("guide.search_placeholder")}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl text-sm"
            style={{ border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)" }}
          />
        </div>

        {filteredSections.map((section) => {
          const originalIdx = sections.indexOf(section);
          const isOpen = openSections.has(originalIdx);
          const contentLines = section.content[locale] || section.content.en || [];

          return (
            <div key={originalIdx} className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)", borderLeft: "3px solid var(--brand-gold)" }}>
              <button
                onClick={() => toggleSection(originalIdx)}
                className="w-full flex items-center gap-3 p-5 text-right hover:opacity-90 transition-opacity"
              >
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--bg-tertiary)" }}>
                  <span style={{ color: "var(--brand-gold)" }}>{section.icon}</span>
                </div>
                <span className="flex-1 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  {t(section.titleKey)}
                </span>
                {isOpen
                  ? <ChevronDown className="h-5 w-5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                  : <ChevronRight className="h-5 w-5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                }
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pr-16">
                  <ul className="space-y-2.5">
                    {contentLines.map((line, i) => (
                      <li key={i} className="flex gap-2 items-start text-sm" style={{ color: "var(--text-secondary)" }}>
                        <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full" style={{ background: "var(--brand-gold)" }} />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
