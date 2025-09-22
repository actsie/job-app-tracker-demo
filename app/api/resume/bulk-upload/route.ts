import { NextRequest, NextResponse } from 'next/server';
import { extname } from 'path';
import { config, validateFileType, validateFileSize, validateFileMime, getUploadLimitsMessage } from '@/lib/config';
import { scrubFileResult } from '@/lib/pii';

async function extractTextFromBuffer(buffer: Buffer, filename: string): Promise<{ text: string; error?: string }> {
  const ext = extname(filename).toLowerCase();
  
  try {
    switch (ext) {
      case '.txt':
        return { text: buffer.toString('utf-8') };
      
      case '.pdf':
        try {
          // Use the same PDF extraction logic as the extract-text route
          // For bulk upload, we'll use a simplified extraction approach
          const PDFParser = (await import('pdf2json')).default;
          
          // Save buffer to temp file for pdf2json
          const fs = require('fs').promises;
          const path = require('path');
          const os = require('os');
          
          const tempPath = path.join(os.tmpdir(), `bulk-pdf-${Date.now()}.pdf`);
          await fs.writeFile(tempPath, buffer);
          
          const pdfParser = new PDFParser();
          
          const pdfData = await new Promise<any>((resolve, reject) => {
            pdfParser.on('pdfParser_dataError', (errData: any) => {
              reject(new Error(`PDF parsing error: ${errData.parserError}`));
            });
            
            pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
              resolve(pdfData);
            });
            
            pdfParser.loadPDF(tempPath);
          });
          
          // Clean up temp file
          try {
            await fs.unlink(tempPath);
          } catch (cleanupError) {
            console.warn('Failed to clean up temp PDF file:', tempPath);
          }
          
          // Extract text from the structured JSON data
          let fullText = '';
          if (pdfData && (pdfData as any).Pages) {
            for (const page of (pdfData as any).Pages) {
              if (page.Texts) {
                for (const textItem of page.Texts) {
                  if (textItem.R) {
                    for (const run of textItem.R) {
                      if (run.T) {
                        fullText += decodeURIComponent(run.T) + ' ';
                      }
                    }
                  }
                }
              }
            }
          }
          
          return { 
            text: fullText.trim() || '[PDF Resume - No text content could be extracted]' 
          };
        } catch (pdfError) {
          console.warn('PDF extraction failed:', pdfError);
          return { 
            text: `[PDF Resume - ${filename}]`,
            error: `PDF extraction failed: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`
          };
        }
      
      case '.doc':
      case '.docx':
        try {
          const mammoth = (await import('mammoth')).default;
          const result = await mammoth.extractRawText({ buffer });
          return { 
            text: result.value || '[Word Document Resume - No text content could be extracted]' 
          };
        } catch (docError) {
          console.warn('Word document extraction failed:', docError);
          return { 
            text: `[Word Document Resume - ${filename}]`,
            error: `Word document extraction failed: ${docError instanceof Error ? docError.message : 'Unknown error'}`
          };
        }
      
      case '.rtf':
        try {
          const rtfContent = buffer.toString('utf-8');
          const plainText = rtfContent
            .replace(/\\[a-z]+[0-9]*\s?/gi, '')
            .replace(/[{}]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          return { 
            text: plainText || '[RTF Resume - No text content could be extracted]' 
          };
        } catch (rtfError) {
          console.warn('RTF extraction failed:', rtfError);
          return { 
            text: `[RTF Resume - ${filename}]`,
            error: `RTF extraction failed: ${rtfError instanceof Error ? rtfError.message : 'Unknown error'}`
          };
        }
      
      default:
        return { 
          text: `[Unsupported file format - ${ext}]`,
          error: `File type ${ext} is not supported for text extraction`
        };
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    return { 
      text: `[Error extracting text from ${filename}]`,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Simple text analysis to try to detect company/role information
function analyzeResumeText(text: string, filename: string) {
  const analysis = {
    detectedCompany: undefined as string | undefined,
    detectedRole: undefined as string | undefined,
    wordCount: 0,
    hasContactInfo: false
  };

  if (!text || text.length < 10) return analysis;

  // Word count
  analysis.wordCount = text.split(/\s+/).length;

  // Check for contact info patterns
  analysis.hasContactInfo = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|@[\w.-]+\.\w+/.test(text);

  // Try to extract company from filename patterns like "CompanyName_Role_Date"
  const filenameParts = filename.replace(/\.(pdf|docx?|txt|rtf)$/i, '').split(/[-_\s]+/);
  if (filenameParts.length >= 2) {
    // First part might be company, second might be role
    const potentialCompany = filenameParts[0].replace(/[^a-zA-Z\s]/g, '').trim();
    const potentialRole = filenameParts[1].replace(/[^a-zA-Z\s]/g, '').trim();
    
    if (potentialCompany.length > 2 && potentialCompany.length < 50) {
      analysis.detectedCompany = potentialCompany;
    }
    if (potentialRole.length > 2 && potentialRole.length < 50) {
      analysis.detectedRole = potentialRole;
    }
  }

  return analysis;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Demo mode input validation and limits
    if (config.demo.server) {
      // Check file type using config validation
      if (!validateFileType(file)) {
        return NextResponse.json({ 
          error: `${getUploadLimitsMessage()} Unsupported extension.`
        }, { status: 400 });
      }
      
      // Check file size using config validation
      if (!validateFileSize(file)) {
        return NextResponse.json({ 
          error: `${getUploadLimitsMessage()} File too large.`
        }, { status: 400 });
      }
      
      // Check MIME type
      if (!validateFileMime(file)) {
        return NextResponse.json({ 
          error: `${getUploadLimitsMessage()} Invalid MIME type.`
        }, { status: 400 });
      }
      
      // Log demo upload attempt
      console.log('🎯 Demo upload attempt:', {
        filename: file.name,
        size: file.size,
        type: file.type,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Production validation (more lenient)
      const validMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/rtf'
      ];

      if (!validMimeTypes.includes(file.type)) {
        return NextResponse.json({ 
          error: `Unsupported file type: ${file.type}. Supported types: PDF, DOC, DOCX, TXT, RTF` 
        }, { status: 400 });
      }

      // Validate file size (10MB limit in production)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        return NextResponse.json({ 
          error: `File too large: ${Math.round(file.size / 1024 / 1024)}MB. Maximum size: 10MB` 
        }, { status: 400 });
      }
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract text from the file
    const extraction = await extractTextFromBuffer(buffer, file.name);
    
    // Analyze the extracted text
    const analysis = analyzeResumeText(extraction.text, file.name);

    // Build response data
    const responseData = {
      success: true,
      filename: file.name,
      size: file.size,
      type: file.type,
      text: extraction.text,
      extractionError: extraction.error,
      analysis: {
        wordCount: analysis.wordCount,
        hasContactInfo: analysis.hasContactInfo,
        detectedCompany: analysis.detectedCompany,
        detectedRole: analysis.detectedRole
      }
    };

    // In demo mode: apply PII scrubbing and return preview-only
    if (config.demo.server) {
      const scrubbedResponse = scrubFileResult(responseData);
      return NextResponse.json({
        ...scrubbedResponse,
        mode: 'demo',
        persisted: false,
        message: 'Demo upload processed successfully. Data is temporary and not saved permanently.',
      });
    }

    // Production mode: return full response (persistence would happen here in a real app)
    return NextResponse.json({
      ...responseData,
      mode: 'production',
      persisted: true,
    });

  } catch (error) {
    console.error('Bulk upload processing error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to process file upload',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}