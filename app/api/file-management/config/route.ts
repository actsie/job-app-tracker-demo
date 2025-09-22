import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { FileManagementPolicy, getDefaultFileManagementPolicy } from '@/lib/file-management';

const CONFIG_FILE = join(process.cwd(), 'file-management-config.json');

/**
 * GET /api/file-management/config
 * Retrieves the current file management configuration
 */
export async function GET() {
  try {
    let config: FileManagementPolicy;
    
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      config = { ...getDefaultFileManagementPolicy(), ...JSON.parse(configData) };
    } catch {
      // Config file doesn't exist, use defaults
      config = getDefaultFileManagementPolicy();
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Failed to get file management config:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/file-management/config
 * Updates the file management configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const updates: Partial<FileManagementPolicy> = await request.json();
    
    // Load existing config or defaults
    let config: FileManagementPolicy;
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      config = { ...getDefaultFileManagementPolicy(), ...JSON.parse(configData) };
    } catch {
      config = getDefaultFileManagementPolicy();
    }

    // Validate and apply updates
    const updatedConfig: FileManagementPolicy = {
      ...config,
      ...updates
    };

    // Validate root directory
    if (updates.rootDirectory) {
      try {
        await fs.access(updates.rootDirectory);
      } catch {
        // Try to create the directory
        try {
          await fs.mkdir(updates.rootDirectory, { recursive: true });
        } catch (error) {
          return NextResponse.json(
            { error: `Cannot access or create root directory: ${updates.rootDirectory}` },
            { status: 400 }
          );
        }
      }
    }

    // Validate migration log path
    if (updates.migrationLogPath) {
      try {
        await fs.mkdir(updates.migrationLogPath, { recursive: true });
      } catch (error) {
        return NextResponse.json(
          { error: `Cannot create migration log directory: ${updates.migrationLogPath}` },
          { status: 400 }
        );
      }
    }

    // Save updated configuration
    await fs.writeFile(CONFIG_FILE, JSON.stringify(updatedConfig, null, 2));

    return NextResponse.json({ 
      config: updatedConfig,
      message: 'Configuration updated successfully' 
    });
  } catch (error) {
    console.error('Failed to update file management config:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/file-management/config/test
 * Tests the current configuration
 */
export async function POST(request: NextRequest) {
  try {
    const { path }: { path: string } = await request.json();
    
    if (!path) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      );
    }

    // Test if path exists or can be created
    try {
      await fs.access(path);
    } catch {
      try {
        await fs.mkdir(path, { recursive: true });
        // Clean up test directory if we created it
        try {
          await fs.rmdir(path);
        } catch {
          // Directory not empty or other error, leave it
        }
      } catch (error) {
        return NextResponse.json(
          { 
            valid: false, 
            error: `Cannot access or create directory: ${error instanceof Error ? error.message : 'Unknown error'}` 
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ 
      valid: true, 
      message: 'Path is valid and accessible' 
    });
  } catch (error) {
    console.error('Failed to test path:', error);
    return NextResponse.json(
      { error: 'Failed to test path' },
      { status: 500 }
    );
  }
}