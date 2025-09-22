import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json();

    if (!path || typeof path !== 'string') {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      );
    }

    // Test if we can create the directory and write to it
    try {
      await fs.mkdir(path, { recursive: true });
      
      // Test write permissions by creating a test file
      const testFilePath = join(path, '.storage_test');
      await fs.writeFile(testFilePath, 'test', 'utf-8');
      
      // Clean up test file
      await fs.unlink(testFilePath);
      
      return NextResponse.json({
        success: true,
        message: 'Storage path is accessible and writable',
        path,
      });
    } catch (error) {
      console.error('Storage path test failed:', error);
      return NextResponse.json(
        { 
          error: 'Path is not accessible or writable',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in test-path API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}