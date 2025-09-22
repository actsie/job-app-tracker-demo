import { NextRequest, NextResponse } from 'next/server';
import { operationsLog } from '@/lib/operations-log';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 10;
    
    const operations = await operationsLog.getRecentOperations(limit);
    return NextResponse.json({ operations });
  } catch (error) {
    console.error('Error loading recent operations:', error);
    return NextResponse.json(
      { error: 'Failed to load recent operations' },
      { status: 500 }
    );
  }
}