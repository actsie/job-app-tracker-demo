import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = await getCurrentAuthToken();
    
    return NextResponse.json({
      token,
      message: 'Use this token for browser helper authentication',
      expires_in_hours: 24,
    });
  } catch (error) {
    console.error('Error getting auth token:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication token' },
      { status: 500 }
    );
  }
}