import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * GET /api/jobs/[uuid]/files
 * Returns information about available files for a job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;
    
    if (!uuid) {
      return NextResponse.json(
        { error: 'Job UUID is required' },
        { status: 400 }
      );
    }

    // Check for files in multiple possible locations
    const possibleLocations = [
      join(process.cwd(), 'job-descriptions'),
      join(process.cwd(), 'jobs'),
      join(process.cwd(), 'data', 'jobs'),
      '/tmp/job-descriptions',
    ];

    let jobFiles = {
      hasJsonFile: false,
      hasTxtFile: false,
      hasHtmlFile: false,
      hasSnapshotFile: false,
      jsonPath: undefined as string | undefined,
      txtPath: undefined as string | undefined,
      htmlPath: undefined as string | undefined,
      snapshotPath: undefined as string | undefined,
    };

    // Search for files in each location
    for (const location of possibleLocations) {
      try {
        await fs.access(location);
        
        // Look for files with the UUID
        const possibleFiles = [
          { name: `${uuid}.json`, type: 'json' as const },
          { name: `${uuid}.txt`, type: 'txt' as const },
          { name: `${uuid}.html`, type: 'html' as const },
          { name: `${uuid}_snapshot.png`, type: 'snapshot' as const },
          { name: `snapshot_${uuid}.png`, type: 'snapshot' as const },
        ];

        for (const file of possibleFiles) {
          const filePath = join(location, file.name);
          try {
            await fs.access(filePath);
            (jobFiles as any)[`has${file.type.charAt(0).toUpperCase() + file.type.slice(1)}File`] = true;
            (jobFiles as any)[`${file.type}Path`] = filePath;
          } catch {
            // File doesn't exist, continue
          }
        }

        // If we found some files in this location, we can stop searching
        if (jobFiles.hasJsonFile || jobFiles.hasTxtFile) {
          break;
        }
      } catch {
        // Location doesn't exist, continue
      }
    }

    // Also check if we have files in the file management system
    const storageConfig = join(process.cwd(), 'file-management-config.json');
    try {
      const configData = await fs.readFile(storageConfig, 'utf-8');
      const config = JSON.parse(configData);
      
      if (config.rootDirectory) {
        // Look for job files in structured folders
        const rootDir = config.rootDirectory;
        try {
          const companies = await fs.readdir(rootDir, { withFileTypes: true });
          
          for (const company of companies) {
            if (company.isDirectory()) {
              const companyPath = join(rootDir, company.name);
              const roles = await fs.readdir(companyPath, { withFileTypes: true });
              
              for (const role of roles) {
                if (role.isDirectory()) {
                  const rolePath = join(companyPath, role.name);
                  const jobJsonPath = join(rolePath, 'job.json');
                  const jobTxtPath = join(rolePath, 'job.txt');
                  
                  try {
                    // Check if this is our job by reading the JSON
                    const jobData = JSON.parse(await fs.readFile(jobJsonPath, 'utf-8'));
                    if (jobData.uuid === uuid) {
                      jobFiles.hasJsonFile = true;
                      jobFiles.jsonPath = jobJsonPath;
                      
                      try {
                        await fs.access(jobTxtPath);
                        jobFiles.hasTxtFile = true;
                        jobFiles.txtPath = jobTxtPath;
                      } catch {
                        // txt file doesn't exist
                      }
                      
                      // Look for other files in the same directory
                      const roleFiles = await fs.readdir(rolePath);
                      for (const file of roleFiles) {
                        if (file.endsWith('.html')) {
                          jobFiles.hasHtmlFile = true;
                          jobFiles.htmlPath = join(rolePath, file);
                        } else if (file.match(/snapshot.*\.png$/i)) {
                          jobFiles.hasSnapshotFile = true;
                          jobFiles.snapshotPath = join(rolePath, file);
                        }
                      }
                      
                      // Found our job, stop searching
                      return NextResponse.json(jobFiles);
                    }
                  } catch {
                    // This job.json is not ours or invalid, continue
                  }
                }
              }
            }
          }
        } catch {
          // Could not search structured folders
        }
      }
    } catch {
      // No file management config
    }

    return NextResponse.json(jobFiles);
  } catch (error) {
    console.error('Failed to check job files:', error);
    return NextResponse.json(
      { error: 'Failed to check job files' },
      { status: 500 }
    );
  }
}