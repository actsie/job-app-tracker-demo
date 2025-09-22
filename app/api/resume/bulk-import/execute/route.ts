import { NextResponse } from 'next/server';
import { bulkImportService } from '@/lib/bulk-import';

export async function POST() {
  try {
    // Load current preview before executing
    const currentPreview = await bulkImportService.loadCurrentPreview();
    if (!currentPreview) {
      return NextResponse.json(
        { error: 'No active bulk import operation found. Please scan a folder first.' },
        { status: 404 }
      );
    }

    const results = await bulkImportService.executeImport();
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error executing bulk import:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute import' },
      { status: 500 }
    );
  }
}