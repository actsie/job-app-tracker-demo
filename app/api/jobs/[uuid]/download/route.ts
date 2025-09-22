import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * GET /api/jobs/[uuid]/download?type=json|txt|html|snapshot
 * Downloads a specific file for a job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    
    if (!uuid) {
      return NextResponse.json(
        { error: 'Job UUID is required' },
        { status: 400 }
      );
    }

    if (!type || !['json', 'txt', 'html', 'snapshot'].includes(type)) {
      return NextResponse.json(
        { error: 'Valid file type is required (json, txt, html, snapshot)' },
        { status: 400 }
      );
    }

    let filePath: string | null = null;
    let contentType: string = '';
    let filename: string = '';

    // First try to get file info from the files endpoint logic
    const filesResponse = await fetch(`${request.nextUrl.origin}/api/jobs/${uuid}/files`);
    let jobFiles = null;
    
    if (filesResponse.ok) {
      jobFiles = await filesResponse.json();
    }

    // Determine file path based on type
    switch (type) {
      case 'json':
        filePath = jobFiles?.jsonPath;
        contentType = 'application/json';
        filename = `job_${uuid.slice(0, 8)}.json`;
        break;
      case 'txt':
        filePath = jobFiles?.txtPath;
        contentType = 'text/plain';
        filename = `job_${uuid.slice(0, 8)}.txt`;
        break;
      case 'html':
        filePath = jobFiles?.htmlPath;
        contentType = 'text/html';
        filename = `job_${uuid.slice(0, 8)}.html`;
        break;
      case 'snapshot':
        filePath = jobFiles?.snapshotPath;
        contentType = 'image/png';
        filename = `job_snapshot_${uuid.slice(0, 8)}.png`;
        break;
    }

    if (!filePath) {
      // Fallback: try to find the file in common locations
      const possibleLocations = [
        join(process.cwd(), 'job-descriptions'),
        join(process.cwd(), 'jobs'),
        join(process.cwd(), 'data', 'jobs'),
        '/tmp/job-descriptions',
      ];

      const possibleFilenames = [
        `${uuid}.${type}`,
        type === 'snapshot' ? `${uuid}_snapshot.png` : null,
        type === 'snapshot' ? `snapshot_${uuid}.png` : null,
      ].filter(Boolean) as string[];

      for (const location of possibleLocations) {
        for (const possibleFilename of possibleFilenames) {
          const testPath = join(location, possibleFilename);
          try {
            await fs.access(testPath);
            filePath = testPath;
            break;
          } catch {
            // File doesn't exist, continue
          }
        }
        if (filePath) break;
      }
    }

    if (!filePath) {
      return NextResponse.json(
        { error: `${type.toUpperCase()} file not found for this job` },
        { status: 404 }
      );
    }

    try {
      const fileContent = await fs.readFile(filePath);
      
      return new NextResponse(fileContent as any, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Expires': '0',
          'Pragma': 'no-cache'
        },
      });
    } catch (error) {
      console.error(`Failed to read ${type} file:`, error);
      return NextResponse.json(
        { error: `Failed to read ${type} file` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Failed to download job file:', error);
    return NextResponse.json(
      { error: 'Failed to download job file' },
      { status: 500 }
    );
  }
}