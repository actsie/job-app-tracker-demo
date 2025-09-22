import { NextResponse } from 'next/server';
import { undoService } from '@/lib/undo-service';

export async function GET() {
  try {
    const operations = await undoService.getUndoableOperations();
    return NextResponse.json({ operations });
  } catch (error) {
    console.error('Error loading undoable operations:', error);
    return NextResponse.json(
      { error: 'Failed to load undoable operations' },
      { status: 500 }
    );
  }
}