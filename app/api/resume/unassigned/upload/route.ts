import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { UnassignedResumeEntry } from '@/lib/types';

const UNASSIGNED_MANIFEST_PATH = join(process.cwd(), 'data', 'unassigned-manifest.json');
const UNASSIGNED_STORAGE_PATH = join(process.cwd(), 'data', 'unassigned-resumes');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('file') as File[];
    const isBulkUpload = files.length > 1;

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    if (isBulkUpload) {
      return await handleBulkUpload(files);
    } else {
      return await handleSingleUpload(files[0]);
    }

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}

async function handleSingleUpload(file: File) {
  try {
    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const supportedTypes = ['.pdf', '.docx', '.doc', '.txt'];
    
    if (!supportedTypes.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      );
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large (max 10MB)' },
        { status: 400 }
      );
    }

    // Check for zero-byte files
    if (file.size === 0) {
      return NextResponse.json(
        { error: 'Empty file (0 bytes)' },
        { status: 400 }
      );
    }

    // Skip suspiciously small files (less than 100 bytes, likely corrupt)
    if (file.size < 100) {
      return NextResponse.json(
        { error: 'File too small (likely corrupt)' },
        { status: 400 }
      );
    }

    await ensureDirectories();

    // Read file content for hashing
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Basic file content validation
    if (fileExtension === '.pdf') {
      // Check if file starts with PDF header
      const pdfHeader = buffer.subarray(0, 4);
      if (pdfHeader.toString() !== '%PDF') {
        return NextResponse.json(
          { error: 'Invalid PDF file (corrupt or not a PDF)' },
          { status: 400 }
        );
      }
    }

    if (fileExtension === '.docx') {
      // Check if file starts with ZIP header (DOCX is a ZIP file)
      const zipHeader = buffer.subarray(0, 2);
      if (zipHeader[0] !== 0x50 || zipHeader[1] !== 0x4B) {
        return NextResponse.json(
          { error: 'Invalid DOCX file (corrupt or not a DOCX)' },
          { status: 400 }
        );
      }
    }
    
    // Calculate content hash for deduplication
    const contentHash = createHash('sha256').update(buffer).digest('hex');

    // Load current manifest
    const manifest = await loadUnassignedManifest();
    
    // Check for duplicates - treat as attachment opportunities
    const existingResume = manifest.resumes.find(r => r.content_hash === contentHash);
    if (existingResume) {
      return NextResponse.json({
        duplicate: true,
        existing: existingResume,
        message: 'Already in library - ready to attach to jobs'
      });
    }

    // Generate unique ID and filename with collision handling
    const resumeId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Check for filename collisions and suggest alternatives
    let storedFilename = `${timestamp}_${resumeId.substring(0, 8)}_${sanitizedFilename}`;
    let managedPath = join(UNASSIGNED_STORAGE_PATH, storedFilename);
    
    // Generate alternative filename if collision detected
    let counter = 1;
    while (manifest.resumes.some(r => r.managed_path === managedPath)) {
      const nameWithoutExt = sanitizedFilename.replace(/\.[^.]*$/, '');
      const extension = sanitizedFilename.match(/\.[^.]*$/)?.[0] || '';
      storedFilename = `${timestamp}_${resumeId.substring(0, 8)}_${nameWithoutExt}_${counter}${extension}`;
      managedPath = join(UNASSIGNED_STORAGE_PATH, storedFilename);
      counter++;
    }

    // Save file
    await fs.writeFile(managedPath, buffer);

    // Create unassigned resume entry
    const unassignedResume: UnassignedResumeEntry = {
      id: resumeId,
      filename: file.name,
      managed_path: managedPath,
      file_size: file.size,
      file_extension: fileExtension,
      content_hash: contentHash,
      uploaded_at: new Date().toISOString(),
      extraction_status: 'pending',
      preview_available: ['.pdf', '.docx', '.doc'].includes(fileExtension)
    };

    // Add to manifest
    manifest.resumes.push(unassignedResume);
    await saveUnassignedManifest(manifest);

    // Start text extraction in background
    extractTextInBackground(unassignedResume);

    return NextResponse.json({
      success: true,
      resume: unassignedResume
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}

async function handleBulkUpload(files: File[]) {
  try {
    await ensureDirectories();
    
    const supportedTypes = ['.pdf', '.docx', '.doc', '.txt'];
    const results = {
      imported: 0,
      duplicates: 0,
      errors: 0,
      details: [] as Array<{
        filename: string;
        status: 'imported' | 'duplicate' | 'error';
        message?: string;
        resume?: UnassignedResumeEntry;
      }>
    };

    // Load current manifest once
    const manifest = await loadUnassignedManifest();

    for (const file of files) {
      try {
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        // Skip unsupported file types
        if (!supportedTypes.includes(fileExtension)) {
          results.errors++;
          results.details.push({
            filename: file.name,
            status: 'error',
            message: 'Unsupported file type'
          });
          continue;
        }

        // Skip files that are too large
        if (file.size > 10 * 1024 * 1024) {
          results.errors++;
          results.details.push({
            filename: file.name,
            status: 'error',
            message: 'File too large (max 10MB)'
          });
          continue;
        }

        // Skip zero-byte files
        if (file.size === 0) {
          results.errors++;
          results.details.push({
            filename: file.name,
            status: 'error',
            message: 'Empty file (0 bytes)'
          });
          continue;
        }

        // Skip suspiciously small files (less than 100 bytes, likely corrupt)
        if (file.size < 100) {
          results.errors++;
          results.details.push({
            filename: file.name,
            status: 'error',
            message: 'File too small (likely corrupt)'
          });
          continue;
        }

        // Read file content for hashing
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Basic file content validation
        if (fileExtension === '.pdf') {
          // Check if file starts with PDF header
          const pdfHeader = buffer.subarray(0, 4);
          if (pdfHeader.toString() !== '%PDF') {
            results.errors++;
            results.details.push({
              filename: file.name,
              status: 'error',
              message: 'Invalid PDF file (corrupt or not a PDF)'
            });
            continue;
          }
        }

        if (fileExtension === '.docx') {
          // Check if file starts with ZIP header (DOCX is a ZIP file)
          const zipHeader = buffer.subarray(0, 2);
          if (zipHeader[0] !== 0x50 || zipHeader[1] !== 0x4B) {
            results.errors++;
            results.details.push({
              filename: file.name,
              status: 'error',
              message: 'Invalid DOCX file (corrupt or not a DOCX)'
            });
            continue;
          }
        }
        
        // Calculate content hash for deduplication
        const contentHash = createHash('sha256').update(buffer).digest('hex');
        
        // Check for duplicates - treat as attachment opportunities
        const existingResume = manifest.resumes.find(r => r.content_hash === contentHash);
        if (existingResume) {
          results.duplicates++;
          results.details.push({
            filename: file.name,
            status: 'duplicate',
            message: 'Already in library - ready to attach',
            resume: existingResume
          });
          continue;
        }

        // Generate unique ID and filename with collision handling
        const resumeId = uuidv4();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        
        // Check for filename collisions and suggest alternatives
        let storedFilename = `${timestamp}_${resumeId.substring(0, 8)}_${sanitizedFilename}`;
        let managedPath = join(UNASSIGNED_STORAGE_PATH, storedFilename);
        
        // Generate alternative filename if collision detected
        let counter = 1;
        while (manifest.resumes.some(r => r.managed_path === managedPath)) {
          const nameWithoutExt = sanitizedFilename.replace(/\.[^.]*$/, '');
          const extension = sanitizedFilename.match(/\.[^.]*$/)?.[0] || '';
          storedFilename = `${timestamp}_${resumeId.substring(0, 8)}_${nameWithoutExt}_${counter}${extension}`;
          managedPath = join(UNASSIGNED_STORAGE_PATH, storedFilename);
          counter++;
        }

        // Save file
        await fs.writeFile(managedPath, buffer);

        // Create unassigned resume entry
        const unassignedResume: UnassignedResumeEntry = {
          id: resumeId,
          filename: file.name,
          managed_path: managedPath,
          file_size: file.size,
          file_extension: fileExtension,
          content_hash: contentHash,
          uploaded_at: new Date().toISOString(),
          extraction_status: 'pending',
          preview_available: ['.pdf', '.docx', '.doc'].includes(fileExtension)
        };

        // Add to manifest
        manifest.resumes.push(unassignedResume);

        // Start text extraction in background
        extractTextInBackground(unassignedResume);

        results.imported++;
        results.details.push({
          filename: file.name,
          status: 'imported',
          resume: unassignedResume
        });

      } catch (error) {
        results.errors++;
        results.details.push({
          filename: file.name,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error('Error processing file', file.name, error);
      }
    }

    // Save updated manifest once
    await saveUnassignedManifest(manifest);

    // Generate user-friendly summary message
    const messages = [];
    if (results.imported > 0) messages.push(`${results.imported} new files added`);
    if (results.duplicates > 0) messages.push(`${results.duplicates} files already in library - ready to attach`);
    if (results.errors > 0) messages.push(`${results.errors} errors`);

    return NextResponse.json({
      success: true,
      summary: messages.join(', '),
      showAttachOption: results.duplicates > 0,
      ...results
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json(
      { error: 'Bulk upload failed' },
      { status: 500 }
    );
  }
}

async function ensureDirectories() {
  const dataDir = join(process.cwd(), 'data');
  
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }

  try {
    await fs.access(UNASSIGNED_STORAGE_PATH);
  } catch {
    await fs.mkdir(UNASSIGNED_STORAGE_PATH, { recursive: true });
  }
}

async function loadUnassignedManifest(): Promise<{ resumes: UnassignedResumeEntry[] }> {
  try {
    await fs.access(UNASSIGNED_MANIFEST_PATH);
    const data = await fs.readFile(UNASSIGNED_MANIFEST_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { resumes: [] };
  }
}

async function saveUnassignedManifest(manifest: { resumes: UnassignedResumeEntry[] }) {
  await fs.writeFile(UNASSIGNED_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function extractTextInBackground(resume: UnassignedResumeEntry) {
  try {
    const response = await fetch(`${process.env.NEXTJS_URL || 'http://localhost:3000'}/api/resume/extract-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: resume.managed_path })
    });

    const manifest = await loadUnassignedManifest();
    const resumeIndex = manifest.resumes.findIndex(r => r.id === resume.id);
    
    if (resumeIndex >= 0) {
      if (response.ok) {
        const data = await response.json();
        manifest.resumes[resumeIndex].extracted_text = data.text;
        manifest.resumes[resumeIndex].extraction_status = 'success';
      } else {
        manifest.resumes[resumeIndex].extraction_status = 'failed';
      }
      
      await saveUnassignedManifest(manifest);
    }
  } catch (error) {
    console.error('Background text extraction failed:', error);
  }
}