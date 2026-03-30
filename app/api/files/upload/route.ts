/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyDocument } from '@/lib/claude/classify-document';
import { matchDocumentToCandidate } from '@/lib/claude/match-candidate';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse');

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const results = [];

    for (const file of files) {
      console.log(`Processing file: ${file.name} (${file.size} bytes, ${file.type})`);

      // Validate size (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        results.push({ file: file.name, error: 'File too large (max 50MB)', status: 'error' });
        continue;
      }

      // Extract text
      let extractedText = '';
      let pageCount: number | undefined;
      const buffer = Buffer.from(await file.arrayBuffer());

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        try {
          const pdfData = await pdfParse(buffer);
          extractedText = pdfData.text || '';
          pageCount = pdfData.numpages;
        } catch (e) {
          console.error(`PDF parse failed for ${file.name}:`, e);
          extractedText = `[PDF file: ${file.name}, could not extract text]`;
        }
      } else if (file.name.endsWith('.docx')) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mammoth = require('mammoth');
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value || '';
        } catch (e) {
          console.error(`DOCX parse failed for ${file.name}:`, e);
        }
      }

      // AI Classification
      console.log(`Classifying: ${file.name} (${extractedText.length} chars, ${pageCount || '?'} pages)`);
      const classification = await classifyDocument(extractedText, file.name, pageCount);
      console.log(`Result:`, JSON.stringify(classification));

      // Candidate matching
      let candidateId: string | null = null;
      let matchResult = null;

      if (classification.document_type === 'cv') {
        // For CVs: create new candidate via AI parsing
        try {
          const parseResult = await parseAndCreateCandidate(supabase, extractedText, file.name);
          candidateId = parseResult.candidateId;
        } catch (e) {
          console.error('Failed to create candidate from CV:', e);
          results.push({ file: file.name, error: 'Failed to parse CV', status: 'error' });
          continue;
        }
      } else {
        // For non-CV: try to match to existing candidate
        matchResult = await matchDocumentToCandidate(
          classification.detected_person_name,
          file.name
        );
        candidateId = matchResult?.candidate_id || null;
      }

      // Upload to Storage
      const storagePath = candidateId
        ? `candidates/${candidateId}/${classification.document_type}/${file.name}`
        : `unmatched/${classification.document_type}/${Date.now()}_${file.name}`;

      const { error: storageError } = await supabase.storage
        .from('cvs')
        .upload(storagePath, buffer, { contentType: file.type, upsert: true });

      if (storageError) {
        console.error(`Storage upload failed:`, storageError);
        results.push({ file: file.name, error: 'Storage upload failed', status: 'error' });
        continue;
      }

      const { data: urlData } = supabase.storage.from('cvs').getPublicUrl(storagePath);

      // Save to candidate_files
      await supabase.from('candidate_files').insert({
        candidate_id: candidateId,
        file_name: file.name,
        file_type: classification.document_type,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
        ai_classification_confidence: classification.confidence,
        ai_classification_reasoning: classification.reasoning,
        extracted_text: extractedText.substring(0, 10000),
        metadata: {
          page_count: pageCount,
          detected_person_name: classification.detected_person_name,
          detected_role: classification.detected_role,
          is_construction_related: classification.is_construction_related,
          summary: classification.summary,
          match_result: matchResult
        }
      });

      // Update candidate if portfolio matched
      if (candidateId && classification.document_type === 'portfolio') {
        await supabase.from('candidates').update({
          portfolio_url: urlData.publicUrl,
          has_portfolio: true
        }).eq('id', candidateId);
      }

      // Log activity
      if (candidateId) {
        await supabase.from('activity_log').insert({
          candidate_id: candidateId,
          action: `file_uploaded_${classification.document_type}`,
          details: {
            file_name: file.name,
            file_type: classification.document_type,
            confidence: classification.confidence
          }
        });
      }

      results.push({
        file: file.name,
        status: 'success',
        classification: {
          type: classification.document_type,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
          person_name: classification.detected_person_name
        },
        candidate: candidateId ? {
          id: candidateId,
          matched: matchResult?.matched || (classification.document_type === 'cv'),
          match_method: matchResult?.match_method || 'new_candidate',
          match_confidence: matchResult?.confidence || 1.0
        } : null,
        file_url: urlData.publicUrl
      });
    }

    return NextResponse.json({ success: true, processed: results.length, results });

  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 });
  }
}

// Helper function - reuses existing CV parsing pattern
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseAndCreateCandidate(
  supabase: any,
  text: string,
  fileName: string
) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Extract candidate information from this CV/resume text.
Return ONLY valid JSON with these fields:
{
  "full_name": "string",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "linkedin_url": "string or null",
  "skills": ["array", "of", "skills"],
  "experience_years": number,
  "education": "string",
  "certifications": ["array"],
  "previous_roles": [{"title": "string", "company": "string", "duration": "string"}],
  "detected_job_category": "one of: civil_engineer, architect, quantity_surveyor, electrical_engineer, mechanical_engineer, project_manager, site_engineer, procurement, construction_worker, supervisor, admin, other"
}

CV Text:
${text.substring(0, 5000)}`
    }]
  });

  const responseText = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);

  const { data: candidate, error } = await supabase
    .from('candidates')
    .insert({
      full_name: parsed.full_name || fileName.replace(/\.(pdf|docx?)$/i, ''),
      email: parsed.email,
      phone: parsed.phone,
      location: parsed.location,
      linkedin_url: parsed.linkedin_url,
      skills: parsed.skills || [],
      experience_years: parsed.experience_years,
      education: parsed.education,
      certifications: parsed.certifications || [],
      previous_roles: parsed.previous_roles || [],
      cv_raw_text: text.substring(0, 10000),
      source: 'upload',
      status: 'new'
    })
    .select()
    .single();

  if (error) throw error;
  return { candidateId: candidate.id, parsed };
}
