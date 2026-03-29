"use client";

import { useI18n } from "@/lib/i18n/context";
import {
  Upload, Users, Briefcase, Calendar, MessageSquare, Brain, FolderOpen,
  Settings, BarChart3, ChevronDown, ChevronRight
} from "lucide-react";
import { useState } from "react";

interface GuideSection {
  icon: React.ReactNode;
  title: { he: string; en: string; tl: string };
  steps: { he: string; en: string; tl: string }[];
}

const guide: GuideSection[] = [
  {
    icon: <Upload className="h-5 w-5" />,
    title: { he: "העלאת קורות חיים", en: "Uploading CVs", tl: "Pag-upload ng CV" },
    steps: [
      { he: "לחצו על 'מועמדים' בתפריט הצד", en: "Click 'Candidates' in the sidebar", tl: "I-click ang 'Mga Kandidato' sa sidebar" },
      { he: "לחצו על 'העלה קורות חיים' או 'העלאה מרובה'", en: "Click 'Upload CV' or 'Bulk Upload'", tl: "I-click ang 'Upload CV' o 'Bulk Upload'" },
      { he: "בחרו קבצי PDF או DOCX", en: "Select PDF or DOCX files", tl: "Pumili ng PDF o DOCX files" },
      { he: "המערכת תנתח אוטומטית את קורות החיים עם AI", en: "The system will automatically analyze the CV with AI", tl: "Awtomatikong susuriin ng sistema ang CV gamit ang AI" },
      { he: "המועמד יסווג אוטומטית למקצוע המתאים", en: "The candidate will be automatically classified to the fitting profession", tl: "Awtomatikong ikaklasipika ang kandidato sa tamang propesyon" },
      { he: "ניתן להעלות מסמכים נוספים (תיק עבודות, הסמכות, רישיונות) מתוך פרופיל המועמד", en: "You can upload additional documents (portfolio, certifications, licenses) from the candidate profile", tl: "Maaari kang mag-upload ng karagdagang dokumento mula sa profile ng kandidato" },
    ],
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: { he: "ניהול מועמדים", en: "Managing Candidates", tl: "Pamamahala ng Kandidato" },
    steps: [
      { he: "צפו בכל המועמדים בטבלה עם פילטרים לפי סטטוס, מקצוע ומשרה", en: "View all candidates in a table with filters by status, profession and job", tl: "Tingnan ang lahat ng kandidato sa isang talahanayan na may mga filter" },
      { he: "לחצו על שם מועמד לפתיחת הפרופיל המלא", en: "Click a candidate name to open the full profile", tl: "I-click ang pangalan ng kandidato para buksan ang buong profile" },
      { he: "שנו סטטוס מועמד: חדש → נסקר → ברשימה קצרה → ראיון → אושר/נדחה", en: "Change candidate status: New → Reviewed → Shortlisted → Interview → Approved/Rejected", tl: "Baguhin ang status: Bago → Nasuri → Shortlisted → Panayam → Aprubado/Tinanggihan" },
      { he: "סווגו מועמדים ידנית למקצועות מתוך הפרופיל", en: "Manually classify candidates to professions from their profile", tl: "Manu-manong iuri ang mga kandidato sa mga propesyon" },
      { he: "בחרו מספר מועמדים לפעולות בכמות: שליחת אימייל, שינוי סטטוס", en: "Select multiple candidates for bulk actions: send email, change status", tl: "Pumili ng maraming kandidato para sa bulk actions" },
    ],
  },
  {
    icon: <Brain className="h-5 w-5" />,
    title: { he: "ניתוח AI", en: "AI Analysis", tl: "AI Analysis" },
    steps: [
      { he: "כל מועמד שמועלה מנותח אוטומטית על ידי AI", en: "Every uploaded candidate is automatically analyzed by AI", tl: "Bawat na-upload na kandidato ay awtomatikong sinusuri ng AI" },
      { he: "הניתוח כולל: ציון מקצועי, חוזקות, חולשות, שאלות לראיון", en: "Analysis includes: professional score, strengths, weaknesses, interview questions", tl: "Kasama sa pagsusuri: professional score, strengths, weaknesses, interview questions" },
      { he: "כל מקצוע מנותח עם פרומפט ייעודי המותאם לתפקיד", en: "Each profession is analyzed with a dedicated prompt tailored to the role", tl: "Bawat propesyon ay sinusuri gamit ang dedikadong prompt" },
      { he: "ניתן להריץ ניתוח מחדש מתוך פרופיל המועמד", en: "You can re-run analysis from the candidate profile", tl: "Maaari mong patakbuhin muli ang pagsusuri mula sa profile" },
      { he: "השתמשו בעוזר AI הפנימי לשאלות והמלצות", en: "Use the internal AI assistant for questions and recommendations", tl: "Gamitin ang internal AI assistant para sa mga tanong at rekomendasyon" },
    ],
  },
  {
    icon: <FolderOpen className="h-5 w-5" />,
    title: { he: "סינון לפי מקצוע", en: "Filtering by Profession", tl: "Pag-filter ayon sa Propesyon" },
    steps: [
      { he: "לחצו על 'מקצועות' בתפריט הצד", en: "Click 'Professions' in the sidebar", tl: "I-click ang 'Mga Propesyon' sa sidebar" },
      { he: "בחרו מקצוע לצפייה בכל המועמדים הרלוונטיים", en: "Select a profession to view all relevant candidates", tl: "Pumili ng propesyon para tingnan ang lahat ng kaugnay na kandidato" },
      { he: "צפו בגרפים ונתונים סטטיסטיים לכל מקצוע", en: "View charts and statistics for each profession", tl: "Tingnan ang mga tsart at estadistika para sa bawat propesyon" },
      { he: "הפיקו המלצות AI למנכ\"ל לכל מקצוע", en: "Generate AI recommendations for the CEO per profession", tl: "Gumawa ng AI recommendations para sa CEO bawat propesyon" },
    ],
  },
  {
    icon: <Briefcase className="h-5 w-5" />,
    title: { he: "ניהול משרות", en: "Managing Jobs", tl: "Pamamahala ng Trabaho" },
    steps: [
      { he: "צרו משרה חדשה עם כותרת, מחלקה, מיקום ודרישות", en: "Create a new job with title, department, location and requirements", tl: "Gumawa ng bagong trabaho" },
      { he: "צפו במועמדים לכל משרה עם גרפי השוואה", en: "View candidates per job with comparison charts", tl: "Tingnan ang mga kandidato bawat trabaho na may mga tsart" },
      { he: "הריצו דירוג AI לכל המועמדים במשרה", en: "Run AI scoring for all candidates in a job", tl: "Patakbuhin ang AI scoring para sa lahat ng kandidato" },
    ],
  },
  {
    icon: <Calendar className="h-5 w-5" />,
    title: { he: "ראיונות", en: "Interviews", tl: "Mga Panayam" },
    steps: [
      { he: "קבעו ראיון: בחרו מועמד, משרה, תאריך, סוג (פרונטלי/וידאו/טלפון)", en: "Schedule interview: select candidate, job, date, type (in-person/video/phone)", tl: "Mag-iskedyul ng panayam" },
      { he: "צפו בראיונות קרובים וקודמים", en: "View upcoming and past interviews", tl: "Tingnan ang mga paparating at nakaraang panayam" },
      { he: "סמנו תוצאה: עבר/נכשל", en: "Mark outcome: passed/failed", tl: "Markahan ang resulta: pumasa/nabigo" },
    ],
  },
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: { he: "הודעות", en: "Messages", tl: "Mga Mensahe" },
    steps: [
      { he: "שלחו הודעות למועמדים באימייל או WhatsApp", en: "Send messages to candidates via email or WhatsApp", tl: "Magpadala ng mensahe sa mga kandidato" },
      { he: "השתמשו בתבניות מוכנות או כתבו הודעה חופשית", en: "Use ready-made templates or write a custom message", tl: "Gumamit ng mga template o sumulat ng custom na mensahe" },
      { he: "שליחה בכמות: בחרו מועמדים מהטבלה ושלחו אימייל לכולם", en: "Bulk send: select candidates from the table and email them all", tl: "Bulk send: pumili ng mga kandidato at mag-email sa lahat" },
    ],
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: { he: "דשבורד ודו\"חות", en: "Dashboard & Reports", tl: "Dashboard at Reports" },
    steps: [
      { he: "הדשבורד מציג סטטיסטיקות: מועמדים, ראיונות, אישורים", en: "Dashboard shows statistics: candidates, interviews, approvals", tl: "Ipinapakita ng dashboard ang mga estadistika" },
      { he: "גרפים: התפלגות ציונים, pipeline מועמדים, משרות מובילות", en: "Charts: score distribution, candidate pipeline, top jobs", tl: "Mga tsart: distribusyon ng score, pipeline ng kandidato" },
      { he: "השתמשו בעוזר AI לדו\"חות שבועיים ותובנות", en: "Use AI assistant for weekly reports and insights", tl: "Gamitin ang AI assistant para sa mga lingguhang ulat" },
    ],
  },
  {
    icon: <Settings className="h-5 w-5" />,
    title: { he: "הגדרות", en: "Settings", tl: "Mga Setting" },
    steps: [
      { he: "שפה: עברית / English / Tagalog - מתחלף מהתפריט הצדי", en: "Language: Hebrew / English / Tagalog - switch from the sidebar", tl: "Wika: Hebrew / English / Tagalog - ilipat mula sa sidebar" },
      { he: "מצב תצוגה: יום / לילה - כפתור בתפריט הצדי", en: "Display mode: Light / Dark - button in sidebar", tl: "Display mode: Light / Dark - button sa sidebar" },
      { he: "חיבור Gmail ו-WhatsApp להגדרות שליחת הודעות", en: "Connect Gmail and WhatsApp for message sending", tl: "Ikonekta ang Gmail at WhatsApp para sa pagpapadala ng mensahe" },
      { he: "ניהול משתמשים (למנהלים): שינוי תפקידים, הוספה והסרה", en: "User management (admins): change roles, add and remove", tl: "Pamamahala ng user (admin): baguhin ang mga role" },
    ],
  },
];

export default function GuidePage() {
  const { locale } = useI18n();
  const [openSection, setOpenSection] = useState<number>(0);

  const titles = { he: "מדריך למשתמש", en: "User Guide", tl: "Gabay sa User" };
  const subtitles = { he: "כל מה שצריך לדעת כדי להשתמש ב-Blueprint ATS", en: "Everything you need to know to use Blueprint ATS", tl: "Lahat ng kailangan mong malaman para gamitin ang Blueprint ATS" };

  return (
    <div className="min-h-screen" style={{ background: 'var(--gray-50)' }}>
      <div className="bg-white dark:bg-slate-800 border-b" style={{ borderColor: 'var(--gray-200)' }}>
        <div className="px-8 py-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>{titles[locale] || titles.he}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--gray-400)' }}>{subtitles[locale] || subtitles.he}</p>
        </div>
      </div>
      <div className="px-8 py-6 max-w-4xl mx-auto space-y-3">
        {guide.map((section, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <button
              onClick={() => setOpenSection(openSection === idx ? -1 : idx)}
              className="w-full flex items-center gap-4 p-5 text-right hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--blue-light)' }}>
                <span style={{ color: 'var(--blue)' }}>{section.icon}</span>
              </div>
              <span className="flex-1 text-base font-semibold text-right" style={{ color: 'var(--navy)' }}>
                {section.title[locale] || section.title.he}
              </span>
              {openSection === idx ? <ChevronDown className="h-5 w-5" style={{ color: 'var(--gray-400)' }} /> : <ChevronRight className="h-5 w-5" style={{ color: 'var(--gray-400)' }} />}
            </button>
            {openSection === idx && (
              <div className="px-5 pb-5">
                <ol className="space-y-3 pr-14">
                  {section.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: 'var(--blue)', color: '#fff' }}>
                        {i + 1}
                      </span>
                      <span className="text-sm leading-relaxed" style={{ color: 'var(--gray-600)' }}>
                        {step[locale] || step.he}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
