import { NextRequest, NextResponse } from 'next/server';
import { undoService } from '@/lib/undo-service';

export async function POST(request: NextRequest) {
  try {
    const { operationId } = await request.json();
    
    if (!operationId) {
      return NextResponse.json(
        { error: 'Operation ID is required' },
        { status: 400 }
      );
    }

    await undoService.undoOperation(operationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error undoing operation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to undo operation' },
      { status: 500 }
    );
  }
}