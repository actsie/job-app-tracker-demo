import { NextRequest, NextResponse } from 'next/server';
import { bulkImportService } from '@/lib/bulk-import';

export async function POST(request: NextRequest) {
  try {
    const { itemId, updates } = await request.json();
    
    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    // Load current preview before updating
    const currentPreview = await bulkImportService.loadCurrentPreview();
    if (!currentPreview) {
      return NextResponse.json(
        { error: 'No active bulk import operation found. Please scan a folder first.' },
        { status: 404 }
      );
    }

    await bulkImportService.updatePreviewItem(itemId, updates);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating bulk import item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update item' },
      { status: 500 }
    );
  }
}