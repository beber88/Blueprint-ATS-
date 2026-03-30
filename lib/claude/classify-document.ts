import Anthropic from '@anthropic-ai/sdk';

export type DocumentType = 'cv' | 'portfolio' | 'certificate' | 'reference_letter' | 'id_document' | 'cover_letter' | 'other';

export interface ClassificationResult {
  document_type: DocumentType;
  confidence: number;
  reasoning: string;
  detected_person_name: string | null;
  detected_role: string | null;
  is_construction_related: boolean;
  summary: string;
}

const CLASSIFICATION_PROMPT = `You are a document classification AI for a construction company's HR system.
Your job is to analyze the first portion of a document and classify it accurately.

DOCUMENT TYPES:
1. "cv" - A resume/CV. Key signals:
   - Has structured sections: Profile/Summary, Work Experience, Education, Skills, Certifications
   - Contains chronological work history with company names and dates
   - Lists contact information (phone, email)
   - Usually 1-4 pages
   - Written in first or third person about ONE candidate

2. "portfolio" - A work portfolio / project showcase. Key signals:
   - Contains project names, descriptions, and references to visual work
   - References to drawings, renders, 3D models, floor plans, elevations
   - Project categories (residential, commercial, institutional)
   - Often mentions design concepts, materials, specifications
   - Usually 10+ pages
   - May contain references to multiple projects
   - For architects: mentions of floor plans, sections, perspectives, site development
   - For engineers: mentions of structural details, MEP layouts, computations
   - The person's name appears as the AUTHOR, not as a job applicant

3. "certificate" - Professional certification or license document. Key signals:
   - Official document format
   - Issued by a regulatory body or institution
   - Contains registration numbers, dates of issue
   - Short (1-2 pages)

4. "reference_letter" - Recommendation or reference letter. Key signals:
   - Written by someone ABOUT the candidate
   - Letterhead from a company
   - Endorses the candidate's abilities

5. "cover_letter" - Application cover letter. Key signals:
   - Addressed to a specific company/person
   - Expresses interest in a position
   - Short (1 page)

6. "id_document" - Government ID, passport, or visa. Key signals:
   - Official government format
   - Photo ID elements
   - ID numbers

7. "other" - Anything that doesn't fit above categories

CRITICAL RULES:
- A portfolio is NOT a CV. Portfolios showcase PROJECTS, CVs showcase a PERSON'S career history.
- If a document has project images, floor plans, architectural drawings - it's a PORTFOLIO, not a CV.
- If a document has structured work history with dates and bullet points - it's a CV.
- A 50-page architectural document with renders is ALWAYS a portfolio, never a CV.
- Extract the person's full name if visible anywhere in the document.
- Determine if this is construction/engineering/architecture related.

Respond in this EXACT JSON format (no markdown, no backticks):
{
  "document_type": "cv|portfolio|certificate|reference_letter|id_document|cover_letter|other",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this classification was chosen",
  "detected_person_name": "Full Name or null",
  "detected_role": "Their profession/role if detectable, or null",
  "is_construction_related": true,
  "summary": "One sentence summary of the document"
}`;

export async function classifyDocument(
  extractedText: string,
  fileName: string,
  pageCount?: number
): Promise<ClassificationResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const textSample = extractedText.substring(0, 3000);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Classify this document.\n\nFile name: ${fileName}\n${pageCount ? `Page count: ${pageCount}` : ''}\nDocument text (first portion):\n---\n${textSample}\n---\n\n${CLASSIFICATION_PROMPT}`
      }
    ]
  });

  const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    console.error('Failed to parse classification response:', responseText);
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('portfolio') || lowerName.includes('works') || lowerName.includes('projects')) {
      return {
        document_type: 'portfolio',
        confidence: 0.6,
        reasoning: 'Classified by filename pattern (AI parse failed)',
        detected_person_name: null,
        detected_role: null,
        is_construction_related: true,
        summary: 'Portfolio document (classified by filename)'
      };
    }
    return {
      document_type: 'cv',
      confidence: 0.5,
      reasoning: 'Default classification (AI parse failed)',
      detected_person_name: null,
      detected_role: null,
      is_construction_related: true,
      summary: 'Document type unclear'
    };
  }
}
