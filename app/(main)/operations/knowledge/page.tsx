"use client";

import { useEffect, useState } from "react";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Pencil, BookOpen, MessageCircleQuestion, Search } from "lucide-react";
import { toast } from "sonner";
import type { ContextEntry, ContextQuestion, ContextEntryType } from "@/lib/operations/types";

const ENTRY_TYPES: ContextEntryType[] = ["abbreviation", "entity_mapping", "project_phase", "pattern", "general"];
const TYPE_LABELS: Record<ContextEntryType, { en: string; he: string }> = {
  abbreviation: { en: "Abbreviation", he: "קיצור" },
  entity_mapping: { en: "Entity Mapping", he: "מיפוי ישות" },
  project_phase: { en: "Project Phase", he: "שלב פרויקט" },
  pattern: { en: "Pattern", he: "תבנית" },
  general: { en: "General", he: "כללי" },
};
const SOURCE_LABELS: Record<string, { en: string; he: string }> = {
  admin_explanation: { en: "Admin", he: "מנהל" },
  question_answer: { en: "Q&A", he: "שאלה ותשובה" },
  auto_pattern: { en: "Auto", he: "אוטומטי" },
};

interface Project { id: string; name: string }

export default function KnowledgePage() {
  const { locale } = useI18n();
  const isHe = locale === "he";

  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [questions, setQuestions] = useState<ContextQuestion[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // Add dialog state
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ entry_type: "abbreviation" as ContextEntryType, trigger_text: "", resolution: "", scope_project_id: "" });
  const [addBusy, setAddBusy] = useState(false);

  // Edit dialog state
  const [editEntry, setEditEntry] = useState<ContextEntry | null>(null);
  const [editForm, setEditForm] = useState({ trigger_text: "", resolution: "", entry_type: "general" as ContextEntryType });
  const [editBusy, setEditBusy] = useState(false);

  // Answer question state
  const [answerText, setAnswerText] = useState<Record<string, string>>({});
  const [answerBusy, setAnswerBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [eRes, qRes, pRes] = await Promise.all([
      fetch("/api/operations/context").then((r) => r.json()),
      fetch("/api/operations/context/questions?status=pending").then((r) => r.json()),
      fetch("/api/operations/projects").then((r) => r.json()),
    ]);
    setEntries(eRes.entries || []);
    setQuestions(qRes.questions || []);
    setProjects(pRes.projects || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createEntry = async () => {
    if (!addForm.trigger_text.trim() || !addForm.resolution.trim()) return;
    setAddBusy(true);
    try {
      const res = await fetch("/api/operations/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_type: addForm.entry_type,
          trigger_text: addForm.trigger_text.trim(),
          resolution: addForm.resolution.trim(),
          scope_project_id: addForm.scope_project_id || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(isHe ? "ידע נוסף בהצלחה" : "Knowledge added");
      setAddForm({ entry_type: "abbreviation", trigger_text: "", resolution: "", scope_project_id: "" });
      setShowAdd(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setAddBusy(false);
    }
  };

  const toggleActive = async (entry: ContextEntry) => {
    try {
      await fetch(`/api/operations/context/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !entry.is_active }),
      });
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, is_active: !e.is_active } : e));
    } catch {
      toast.error("Error");
    }
  };

  const saveEdit = async () => {
    if (!editEntry) return;
    setEditBusy(true);
    try {
      const res = await fetch(`/api/operations/context/${editEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(isHe ? "עודכן" : "Updated");
      setEditEntry(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setEditBusy(false);
    }
  };

  const answerQuestion = async (qId: string) => {
    const text = answerText[qId];
    if (!text?.trim()) return;
    setAnswerBusy(qId);
    try {
      const res = await fetch(`/api/operations/context/questions/${qId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer_text: text.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(isHe ? "תשובה נשמרה — ידע חדש נוצר" : "Answer saved — new knowledge created");
      setAnswerText((prev) => { const n = { ...prev }; delete n[qId]; return n; });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setAnswerBusy(null);
    }
  };

  const dismissQuestion = async (qId: string) => {
    try {
      await fetch(`/api/operations/context/questions/${qId}/dismiss`, { method: "POST" });
      setQuestions((prev) => prev.filter((q) => q.id !== qId));
    } catch {
      toast.error("Error");
    }
  };

  const filtered = entries.filter((e) => {
    if (filterType !== "all" && e.entry_type !== filterType) return false;
    if (search) {
      const s = search.toLowerCase();
      return e.trigger_text.toLowerCase().includes(s) || e.resolution.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <OpsPageShell
      title={isHe ? "בסיס ידע" : "Knowledge Base"}
      subtitle={isHe ? "למד את המערכת לגבי קיצורים, ישויות ותבניות" : "Teach the system about abbreviations, entities, and patterns"}
    >
      <Tabs defaultValue="knowledge" className="space-y-4">
        <TabsList>
          <TabsTrigger value="knowledge" className="gap-2">
            <BookOpen className="h-4 w-4" />
            {isHe ? "ידע" : "Knowledge"} ({entries.length})
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-2">
            <MessageCircleQuestion className="h-4 w-4" />
            {isHe ? "שאלות ממתינות" : "Pending Questions"} ({questions.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── Knowledge Tab ───────────────────────────────────────────────── */}
        <TabsContent value="knowledge">
          <OpsCard>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isHe ? "חיפוש..." : "Search..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ps-9"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isHe ? "הכל" : "All types"}</SelectItem>
                  {ENTRY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{isHe ? TYPE_LABELS[t].he : TYPE_LABELS[t].en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => setShowAdd(true)} size="sm">
                <Plus className="h-4 w-4 me-1" /> {isHe ? "הוסף ידע" : "Add Knowledge"}
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {isHe ? "אין רשומות ידע עדיין" : "No knowledge entries yet"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-start py-2 px-2">{isHe ? "סוג" : "Type"}</th>
                      <th className="text-start py-2 px-2">{isHe ? "טריגר" : "Trigger"}</th>
                      <th className="text-start py-2 px-2">{isHe ? "משמעות" : "Resolution"}</th>
                      <th className="text-start py-2 px-2">{isHe ? "מקור" : "Source"}</th>
                      <th className="text-center py-2 px-2">{isHe ? "שימושים" : "Uses"}</th>
                      <th className="text-center py-2 px-2">{isHe ? "פעיל" : "Active"}</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => (
                      <tr key={e.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2">
                          <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs">
                            {isHe ? TYPE_LABELS[e.entry_type]?.he : TYPE_LABELS[e.entry_type]?.en}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-mono font-medium">{e.trigger_text}</td>
                        <td className="py-2 px-2 max-w-[300px] truncate">{e.resolution}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">
                          {isHe ? SOURCE_LABELS[e.source]?.he : SOURCE_LABELS[e.source]?.en}
                        </td>
                        <td className="py-2 px-2 text-center">{e.usage_count}</td>
                        <td className="py-2 px-2 text-center">
                          <Switch checked={e.is_active} onCheckedChange={() => toggleActive(e)} />
                        </td>
                        <td className="py-2 px-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditEntry(e);
                              setEditForm({ trigger_text: e.trigger_text, resolution: e.resolution, entry_type: e.entry_type });
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </OpsCard>
        </TabsContent>

        {/* ─── Pending Questions Tab ──────────────────────────────────────── */}
        <TabsContent value="questions">
          <OpsCard>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : questions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {isHe ? "אין שאלות ממתינות" : "No pending questions"}
              </p>
            ) : (
              <div className="space-y-4">
                {questions.map((q) => (
                  <div key={q.id} className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
                    <p className="font-medium mb-1">{q.question_text}</p>
                    {q.question_text_en && q.question_text !== q.question_text_en && (
                      <p className="text-sm text-muted-foreground mb-2">{q.question_text_en}</p>
                    )}
                    {q.context_snippet && (
                      <p className="text-xs bg-muted rounded px-2 py-1 mb-3 font-mono">
                        &ldquo;{q.context_snippet}&rdquo;
                      </p>
                    )}
                    {q.suggested_trigger && (
                      <span className="inline-block text-xs bg-amber-200 dark:bg-amber-800 rounded px-2 py-0.5 mb-2">
                        {q.suggested_trigger}
                      </span>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder={isHe ? "הקלד תשובה..." : "Type your answer..."}
                        value={answerText[q.id] || ""}
                        onChange={(e) => setAnswerText((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => answerQuestion(q.id)}
                        disabled={answerBusy === q.id || !answerText[q.id]?.trim()}
                      >
                        {answerBusy === q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (isHe ? "ענה" : "Answer")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => dismissQuestion(q.id)}>
                        {isHe ? "התעלם" : "Dismiss"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </OpsCard>
        </TabsContent>
      </Tabs>

      {/* ─── Add Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isHe ? "הוסף ידע חדש" : "Add New Knowledge"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isHe ? "סוג" : "Type"}</Label>
              <Select value={addForm.entry_type} onValueChange={(v) => setAddForm((p) => ({ ...p, entry_type: v as ContextEntryType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTRY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{isHe ? TYPE_LABELS[t].he : TYPE_LABELS[t].en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isHe ? "טקסט טריגר" : "Trigger Text"}</Label>
              <Input
                placeholder={isHe ? 'למשל: "PYT"' : 'e.g. "PYT"'}
                value={addForm.trigger_text}
                onChange={(e) => setAddForm((p) => ({ ...p, trigger_text: e.target.value }))}
              />
            </div>
            <div>
              <Label>{isHe ? "משמעות / הסבר" : "Resolution / Meaning"}</Label>
              <Input
                placeholder={isHe ? "למשל: קבלן משנה לשיפוצים" : "e.g. Subcontractor for renovations"}
                value={addForm.resolution}
                onChange={(e) => setAddForm((p) => ({ ...p, resolution: e.target.value }))}
              />
            </div>
            <div>
              <Label>{isHe ? "פרויקט (אופציונלי)" : "Project Scope (optional)"}</Label>
              <Select value={addForm.scope_project_id || "none"} onValueChange={(v) => setAddForm((p) => ({ ...p, scope_project_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{isHe ? "כל הפרויקטים" : "All projects"}</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{isHe ? "ביטול" : "Cancel"}</Button>
            <Button onClick={createEntry} disabled={addBusy || !addForm.trigger_text.trim() || !addForm.resolution.trim()}>
              {addBusy ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              {isHe ? "שמור" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!editEntry} onOpenChange={(open) => { if (!open) setEditEntry(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isHe ? "ערוך ידע" : "Edit Knowledge"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isHe ? "סוג" : "Type"}</Label>
              <Select value={editForm.entry_type} onValueChange={(v) => setEditForm((p) => ({ ...p, entry_type: v as ContextEntryType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTRY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{isHe ? TYPE_LABELS[t].he : TYPE_LABELS[t].en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isHe ? "טקסט טריגר" : "Trigger Text"}</Label>
              <Input value={editForm.trigger_text} onChange={(e) => setEditForm((p) => ({ ...p, trigger_text: e.target.value }))} />
            </div>
            <div>
              <Label>{isHe ? "משמעות / הסבר" : "Resolution / Meaning"}</Label>
              <Input value={editForm.resolution} onChange={(e) => setEditForm((p) => ({ ...p, resolution: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>{isHe ? "ביטול" : "Cancel"}</Button>
            <Button onClick={saveEdit} disabled={editBusy}>
              {editBusy ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              {isHe ? "שמור" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OpsPageShell>
  );
}
