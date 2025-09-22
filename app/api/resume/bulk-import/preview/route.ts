import { NextResponse } from 'next/server';
import { bulkImportService } from '@/lib/bulk-import';

export async function GET() {
  try {
    const operation = await bulkImportService.loadCurrentPreview();
    return NextResponse.json({ operation });
  } catch (error) {
    console.error('Error loading bulk import preview:', error);
    return NextResponse.json(
      { error: 'Failed to load preview' },
      { status: 500 }
    );
  }
}