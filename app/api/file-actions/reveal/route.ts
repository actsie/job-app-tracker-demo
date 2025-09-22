import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { platform as osPlatform } from 'os';

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

    // Reveal file in folder based on platform
    const currentPlatform = osPlatform();
    let command: string;

    switch (currentPlatform) {
      case 'darwin': // macOS
        command = `open -R "${filePath}"`;
        break;
      case 'win32': // Windows
        command = `explorer /select,"${filePath.replace(/\//g, '\\')}"`;
        break;
      default: // Linux and others
        // For Linux, open the containing directory
        const dirPath = dirname(filePath);
        command = `xdg-open "${dirPath}"`;
        break;
    }

    try {
      await execAsync(command);
      return NextResponse.json({
        success: true,
        message: `File revealed in folder`,
        filePath
      });
    } catch (error) {
      console.error('Failed to reveal file in folder:', error);
      return NextResponse.json(
        { 
          error: 'Failed to reveal file in folder',
          details: error instanceof Error ? error.message : undefined 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Reveal file error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to reveal file in folder',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}