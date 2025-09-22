import { NextRequest, NextResponse } from 'next/server';
import { backgroundScheduler } from '@/lib/scheduler';

export async function GET() {
  try {
    const status = backgroundScheduler.getStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    return NextResponse.json(
      { error: 'Failed to get scheduler status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'start') {
      await backgroundScheduler.start();
      return NextResponse.json({ success: true, message: 'Scheduler started' });
    }

    if (action === 'stop') {
      await backgroundScheduler.stop();
      return NextResponse.json({ success: true, message: 'Scheduler stopped' });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "start" or "stop"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error managing scheduler:', error);
    return NextResponse.json(
      { error: 'Failed to manage scheduler' },
      { status: 500 }
    );
  }
}