import { NextRequest, NextResponse } from 'next/server';
import { deduplicationService } from '@/lib/deduplication';

export async function GET() {
  try {
    const config = await deduplicationService.loadConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error loading deduplication config:', error);
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const config = await request.json();
    await deduplicationService.saveConfig(config);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Error saving deduplication config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}