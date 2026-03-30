import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminClient();
    const { candidate_id } = await request.json();

    if (!candidate_id) {
      return NextResponse.json({ error: 'candidate_id required' }, { status: 400 });
    }

    // Get the file record
    const { data: file, error: fileError } = await supabase
      .from('candidate_files')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Update candidate_id
    const { error: updateError } = await supabase
      .from('candidate_files')
      .update({ candidate_id })
      .eq('id', params.id);

    if (updateError) {
      console.error('Assign error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // If portfolio, update candidate record
    if (file.file_type === 'portfolio') {
      await supabase.from('candidates').update({
        portfolio_url: file.file_url,
        has_portfolio: true,
      }).eq('id', candidate_id);
    }

    // Log activity
    await supabase.from('activity_log').insert({
      candidate_id,
      action: `file_assigned_${file.file_type}`,
      details: { file_name: file.file_name, file_id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('File assign error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
