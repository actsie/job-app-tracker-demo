import { NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import archiver from 'archiver';

const pipelineAsync = promisify(pipeline);

export async function GET() {
  try {
    const extensionDir = path.join(process.cwd(), 'browser-extension');
    
    // Check if browser-extension directory exists
    if (!fs.existsSync(extensionDir)) {
      return NextResponse.json(
        { error: 'Browser extension files not found' },
        { status: 404 }
      );
    }

    // Create a temporary zip file path
    const tempZipPath = path.join(process.cwd(), 'temp-extension.zip');
    
    // Create a zip archive
    const output = createWriteStream(tempZipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level
    });

    // Pipe archive data to the file
    archive.pipe(output);

    // Add the entire browser-extension directory to the zip
    archive.directory(extensionDir, false);

    // Finalize the archive
    await archive.finalize();

    // Wait for the zip to be fully written
    await new Promise<void>((resolve, reject) => {
      output.on('close', () => resolve());
      output.on('error', reject);
    });

    // Read the zip file and return it as response
    const zipBuffer = fs.readFileSync(tempZipPath);
    
    // Clean up the temporary file
    fs.unlinkSync(tempZipPath);

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="job-tracker-browser-extension.zip"',
        'Content-Length': zipBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error creating zip file:', error);
    return NextResponse.json(
      { error: 'Failed to create extension download' },
      { status: 500 }
    );
  }
}