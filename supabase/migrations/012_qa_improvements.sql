-- 012_qa_improvements.sql
-- QA improvements: employee hierarchy, item translations, chat context

-- 1A: Employee role level for hierarchy sorting
ALTER TABLE op_employees ADD COLUMN IF NOT EXISTS role_level INTEGER DEFAULT 50;
COMMENT ON COLUMN op_employees.role_level IS 'Hierarchy level: CEO=10, Director/VP=20, Manager=30, Team Lead=40, Employee=50';

-- 1C: Translation cache on report items
ALTER TABLE op_report_items ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}';
COMMENT ON COLUMN op_report_items.translations IS 'Cached translations: { "he": { "issue": "...", "next_action": "..." }, "en": { ... } }';

-- 2A: Chat tables (create if not exist)
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'direct',
  name TEXT,
  module TEXT,
  context_entity_type TEXT,
  context_entity_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  shared_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Add module + context columns if they don't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_conversations' AND column_name = 'module') THEN
    ALTER TABLE chat_conversations ADD COLUMN module TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_conversations' AND column_name = 'context_entity_type') THEN
    ALTER TABLE chat_conversations ADD COLUMN context_entity_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_conversations' AND column_name = 'context_entity_id') THEN
    ALTER TABLE chat_conversations ADD COLUMN context_entity_id UUID;
  END IF;
END $$;

-- Indexes for chat
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_module ON chat_conversations(module) WHERE module IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_context ON chat_conversations(context_entity_type, context_entity_id) WHERE context_entity_type IS NOT NULL;
