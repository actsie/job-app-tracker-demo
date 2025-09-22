import { NextResponse } from 'next/server';
import { bulkImportService } from '@/lib/bulk-import';

export async function POST() {
  try {
    await bulkImportService.cancelOperation();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling bulk import:', error);
    return NextResponse.json(
      { error: 'Failed to cancel operation' },
      { status: 500 }
    );
  }
}