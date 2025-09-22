import { NextRequest, NextResponse } from 'next/server';
import { resumeManager } from '@/lib/resume-manager';

export async function GET() {
  try {
    const config = await resumeManager.loadConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error loading resume config:', error);
    return NextResponse.json(
      { error: 'Failed to load resume configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const config = await request.json();
    await resumeManager.saveConfig(config);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Error saving resume config:', error);
    return NextResponse.json(
      { error: 'Failed to save resume configuration' },
      { status: 500 }
    );
  }
}