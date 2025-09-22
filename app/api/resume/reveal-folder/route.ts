import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { dirname } from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();
    
    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    const folderPath = dirname(filePath);
    
    try {
      // Detect platform and use appropriate command
      const platform = process.platform;
      let command: string;
      
      switch (platform) {
        case 'darwin': // macOS
          command = `open "${folderPath}"`;
          break;
        case 'win32': // Windows
          command = `explorer "${folderPath}"`;
          break;
        default: // Linux and others
          command = `xdg-open "${folderPath}"`;
          break;
      }
      
      await execAsync(command);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error revealing folder:', error);
      return NextResponse.json(
        { error: 'Failed to open folder in file manager' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error revealing folder:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}