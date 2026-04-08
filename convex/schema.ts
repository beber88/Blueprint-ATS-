import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const previousRoleValidator = v.object({
  title: v.string(),
  company: v.string(),
  duration: v.string(),
  description: v.string(),
});

const documentValidator = v.object({
  name: v.string(),
  url: v.string(),
  type: v.string(),
  uploaded_at: v.string(),
  storageId: v.optional(v.id("_storage")),
});

const scorecardItemValidator = v.object({
  criterion: v.string(),
  max: v.number(),
  score: v.number(),
  notes: v.string(),
});

export default defineSchema({
  ...authTables,

  // ═══════════════════════════════════════
  // JOBS
  // ═══════════════════════════════════════
  jobs: defineTable({
    title: v.string(),
    department: v.optional(v.string()),
    description: v.optional(v.string()),
    requirements: v.optional(v.string()),
    location: v.optional(v.string()),
    employment_type: v.optional(v.string()), // full-time, part-time, contract, project, internship
    status: v.string(), // active, paused, closed
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_created_at", ["created_at"]),

  // ═══════════════════════════════════════
  // CANDIDATES
  // ═══════════════════════════════════════
  candidates: defineTable({
    full_name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    linkedin_url: v.optional(v.string()),
    cv_file_url: v.optional(v.string()),
    cv_storage_id: v.optional(v.id("_storage")),
    cv_raw_text: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    experience_years: v.optional(v.number()),
    education: v.optional(v.string()),
    certifications: v.optional(v.array(v.string())),
    previous_roles: v.optional(v.array(previousRoleValidator)),
    notes: v.optional(v.string()),
    source: v.optional(v.string()), // manual, upload, job-board, etc.
    status: v.string(), // new, reviewed, shortlisted, interview_scheduled, interviewed, approved, rejected, keep_for_future
    job_categories: v.optional(v.array(v.string())),
    custom_category: v.optional(v.string()),
    classification_confidence: v.optional(v.number()),
    ai_analysis: v.optional(v.any()),
    overall_ai_score: v.optional(v.number()),
    contact_status: v.optional(v.string()),
    has_portfolio: v.optional(v.boolean()),
    last_contacted_at: v.optional(v.number()),
    documents: v.optional(v.array(documentValidator)),
    job_id: v.optional(v.id("jobs")),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_created_at", ["created_at"])
    .index("by_email", ["email"])
    .index("by_overall_ai_score", ["overall_ai_score"])
    .searchIndex("search_name", { searchField: "full_name" })
    .searchIndex("search_email", { searchField: "email" }),

  // ═══════════════════════════════════════
  // APPLICATIONS (Candidate ↔ Job link)
  // ═══════════════════════════════════════
  applications: defineTable({
    candidate_id: v.id("candidates"),
    job_id: v.id("jobs"),
    ai_score: v.optional(v.number()),
    ai_reasoning: v.optional(v.string()),
    status: v.string(),
    applied_at: v.number(),
  })
    .index("by_job", ["job_id"])
    .index("by_candidate", ["candidate_id"])
    .index("by_ai_score", ["ai_score"])
    .index("by_candidate_job", ["candidate_id", "job_id"]),

  // ═══════════════════════════════════════
  // INTERVIEWS
  // ═══════════════════════════════════════
  interviews: defineTable({
    application_id: v.id("applications"),
    scheduled_at: v.optional(v.number()),
    duration_minutes: v.optional(v.number()),
    interviewer: v.optional(v.string()),
    type: v.optional(v.string()), // in-person, video, phone
    notes: v.optional(v.string()),
    outcome: v.optional(v.string()), // passed, failed, pending
    created_at: v.number(),
  })
    .index("by_scheduled_at", ["scheduled_at"])
    .index("by_application", ["application_id"]),

  // ═══════════════════════════════════════
  // ACTIVITY LOG
  // ═══════════════════════════════════════
  activityLog: defineTable({
    candidate_id: v.id("candidates"),
    action: v.string(),
    details: v.optional(v.any()),
    created_at: v.number(),
  })
    .index("by_candidate", ["candidate_id"])
    .index("by_created_at", ["created_at"]),

  // ═══════════════════════════════════════
  // MESSAGE TEMPLATES
  // ═══════════════════════════════════════
  messageTemplates: defineTable({
    name: v.string(),
    type: v.optional(v.string()), // email, whatsapp
    category: v.optional(v.string()), // interview_invite, rejection, next_stage, offer, general
    subject: v.optional(v.string()),
    body: v.string(),
    variables: v.optional(v.array(v.string())),
    created_at: v.number(),
  }),

  // ═══════════════════════════════════════
  // MESSAGES SENT
  // ═══════════════════════════════════════
  messagesSent: defineTable({
    candidate_id: v.id("candidates"),
    template_id: v.optional(v.id("messageTemplates")),
    channel: v.string(), // email, whatsapp
    to_address: v.string(),
    subject: v.optional(v.string()),
    body: v.string(),
    status: v.optional(v.string()),
    sent_at: v.number(),
  })
    .index("by_candidate", ["candidate_id"]),

  // ═══════════════════════════════════════
  // JOB CATEGORIES
  // ═══════════════════════════════════════
  jobCategories: defineTable({
    key: v.string(),
    name_en: v.string(),
    name_he: v.string(),
    name_tl: v.optional(v.string()),
    sort_order: v.optional(v.number()),
    is_active: v.optional(v.boolean()),
  })
    .index("by_key", ["key"])
    .index("by_sort_order", ["sort_order"]),

  // ═══════════════════════════════════════
  // CANDIDATE FILES
  // ═══════════════════════════════════════
  candidateFiles: defineTable({
    candidate_id: v.optional(v.id("candidates")),
    file_name: v.string(),
    file_url: v.optional(v.string()),
    storage_id: v.optional(v.id("_storage")),
    file_type: v.optional(v.string()), // cv, portfolio, certification, license, etc.
    file_size: v.optional(v.number()),
    detected_name: v.optional(v.string()),
    detected_email: v.optional(v.string()),
    match_status: v.optional(v.string()), // matched, unmatched, manual
    raw_text: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_candidate", ["candidate_id"])
    .index("by_match_status", ["match_status"]),

  // ═══════════════════════════════════════
  // CHAT
  // ═══════════════════════════════════════
  chatConversations: defineTable({
    title: v.optional(v.string()),
    created_by: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_updated_at", ["updated_at"]),

  chatMessages: defineTable({
    conversation_id: v.id("chatConversations"),
    sender_id: v.string(),
    sender_name: v.optional(v.string()),
    content: v.string(),
    created_at: v.number(),
  })
    .index("by_conversation", ["conversation_id"]),

  chatParticipants: defineTable({
    conversation_id: v.id("chatConversations"),
    user_id: v.string(),
    last_read_at: v.optional(v.number()),
    joined_at: v.number(),
  })
    .index("by_conversation", ["conversation_id"])
    .index("by_user", ["user_id"]),

  // ═══════════════════════════════════════
  // JOB REQUIREMENTS / QUESTIONNAIRE
  // ═══════════════════════════════════════
  jobRequirements: defineTable({
    job_id: v.id("jobs"),
    requirements: v.optional(v.any()), // structured requirements JSON
    questionnaire: v.optional(v.any()), // AI-generated questions
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_job", ["job_id"]),

  // ═══════════════════════════════════════
  // JOB BOARD INTEGRATIONS
  // ═══════════════════════════════════════
  jobBoardCredentials: defineTable({
    user_id: v.string(),
    board: v.string(), // indeed, linkedin, etc.
    credentials: v.any(), // encrypted credentials
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_user_board", ["user_id", "board"]),

  jobBoardPosts: defineTable({
    job_id: v.id("jobs"),
    board: v.string(),
    external_id: v.optional(v.string()),
    status: v.optional(v.string()),
    posted_at: v.number(),
  })
    .index("by_job", ["job_id"]),

  // ═══════════════════════════════════════
  // USER PROFILES (extends Convex Auth users)
  // ═══════════════════════════════════════
  userProfiles: defineTable({
    user_id: v.string(), // matches Convex auth user ID
    email: v.string(),
    full_name: v.optional(v.string()),
    avatar_url: v.optional(v.string()),
    role: v.string(), // admin, user
    phone: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),
});
