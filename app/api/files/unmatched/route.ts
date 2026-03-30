import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: files, error } = await supabase
      .from('candidate_files')
      .select('*')
      .is('candidate_id', null)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Unmatched files error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ files: files || [] });
  } catch (error) {
    console.error('Unmatched files API error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
