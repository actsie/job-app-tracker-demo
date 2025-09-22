import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { platform } from 'os';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();
    
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    // Verify file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return NextResponse.json(
        { error: 'File not found', filePath },
        { status: 404 }
      );
    }

    // Open file with system default application based on platform
    const currentPlatform = platform();
    let command: string;

    switch (currentPlatform) {
      case 'darwin': // macOS
        command = `open "${filePath}"`;
        break;
      case 'win32': // Windows
        command = `start "" "${filePath}"`;
        break;
      default: // Linux and others
        command = `xdg-open "${filePath}"`;
        break;
    }

    try {
      await execAsync(command);
      return NextResponse.json({
        success: true,
        message: `File opened with system default application`,
        filePath
      });
    } catch (error) {
      console.error('Failed to open file:', error);
      return NextResponse.json(
        { 
          error: 'Failed to open file with system default application',
          details: error instanceof Error ? error.message : undefined 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Open file error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to open file',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}