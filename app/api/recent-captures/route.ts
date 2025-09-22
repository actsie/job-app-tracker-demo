import { NextRequest, NextResponse } from 'next/server';
import { getRecentCaptures } from '@/lib/browser-capture';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    
    const captures = await getRecentCaptures(limit);
    
    return NextResponse.json({
      captures,
      total: captures.length,
    });
  } catch (error) {
    console.error('Error getting recent captures:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve recent captures' },
      { status: 500 }
    );
  }
}