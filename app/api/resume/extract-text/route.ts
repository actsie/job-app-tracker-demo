import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { extname } from 'path';

async function extractTextFromFile(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();
  
  try {
    switch (ext) {
      case '.txt':
        // Direct text file reading
        return await fs.readFile(filePath, 'utf-8');
      
      case '.pdf':
        try {
          console.log('Attempting PDF extraction for:', filePath);
          
          // First verify file exists and get stats
          const fileStats = await fs.stat(filePath);
          console.log('File stats:', { size: fileStats.size, isFile: fileStats.isFile() });
          
          // Try pdf2json first (structured data extraction)
          try {
            const PDFParser = (await import('pdf2json')).default;
            
            console.log('Attempting pdf2json extraction...');
            const pdfParser = new PDFParser();
            
            const pdfData = await new Promise<any>((resolve, reject) => {
              pdfParser.on('pdfParser_dataError', (errData: any) => {
                reject(new Error(`PDF parsing error: ${errData.parserError}`));
              });
              
              pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
                resolve(pdfData);
              });
              
              pdfParser.loadPDF(filePath);
            });
            
            // Extract text from the structured JSON data
            let fullText = '';
            if (pdfData && (pdfData as any).Pages) {
              for (const page of (pdfData as any).Pages) {
                if (page.Texts) {
                  for (const textItem of page.Texts) {
                    if (textItem.R) {
                      for (const run of textItem.R) {
                        if (run.T) {
                          // Decode URI component to get actual text
                          fullText += decodeURIComponent(run.T) + ' ';
                        }
                      }
                    }
                  }
                  fullText += '\n'; // Add line break between pages
                }
              }
            }
            
            if (fullText.trim()) {
              console.log('PDF text extracted successfully with pdf2json:', fullText.length, 'characters');
              
              // Clean up the text formatting
              const cleanedText = fullText
                .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                .replace(/([a-z])\s+([a-z])/g, '$1$2') // Remove spaces between lowercase letters
                .replace(/([A-Z])\s+([a-z])/g, '$1$2') // Remove spaces between uppercase and lowercase
                .replace(/([a-z])\s+([A-Z])/g, '$1 $2') // Keep space between word boundaries
                .replace(/\s*●\s*/g, '\n• ') // Format bullet points
                .replace(/\s*\|\s*/g, ' | ') // Clean up pipe separators
                .trim();
              
              return cleanedText;
            } else {
              throw new Error('No text content found with pdf2json');
            }
          } catch (pdf2jsonError) {
            console.warn('pdf2json extraction failed:', pdf2jsonError);
            
            // Try pdf-lib as fallback (though it's not ideal for text extraction)
            try {
              console.log('Trying pdf-lib as fallback...');
              const { PDFDocument } = await import('pdf-lib');
              const pdfBuffer = await fs.readFile(filePath);
              const pdfDoc = await PDFDocument.load(pdfBuffer);
              
              // pdf-lib doesn't have direct text extraction capabilities
              // This is mainly a placeholder to show the approach
              console.log('PDF loaded with pdf-lib, but text extraction not supported');
              throw new Error('pdf-lib does not support text extraction');
            } catch (pdfLibError) {
              console.warn('pdf-lib fallback also failed:', pdfLibError);
            }
            
            // Final fallback: Return helpful user message
            const fileName = filePath.split('/').pop() || 'resume.pdf';
            const sizeKB = Math.round(fileStats.size / 1024);
            
            return `📄 PDF Resume: ${fileName} (${sizeKB} KB)

This PDF resume has been successfully uploaded and linked to your job application.

Text extraction from this PDF encountered technical limitations, but the resume file is properly 
stored and can be:

• Downloaded and opened directly from your file system
• Viewed using the resume management features
• Referenced during interview preparation

File location: ${filePath}
File size: ${fileStats.size} bytes
Upload date: ${new Date().toLocaleDateString()}

The resume has been successfully linked to your job application and will be 
available in the Interview Prep modal for reference.`;
          }
          
        } catch (pdfError) {
          console.error('PDF file access failed:', pdfError);
          return `[PDF Resume - File Access Error]\n\nUnable to access the PDF file.\n\nError: ${pdfError instanceof Error ? pdfError.message : 'Unknown file system error'}`;
        }
      
      case '.doc':
      case '.docx':
        try {
          const mammoth = (await import('mammoth')).default;
          const dataBuffer = await fs.readFile(filePath);
          const result = await mammoth.extractRawText({ buffer: dataBuffer });
          return result.value || '[Word Document Resume - No text content could be extracted]';
        } catch (docError) {
          console.warn('Word document extraction failed:', docError);
          return `[Word Document Resume - ${filePath}]\n\nFailed to extract text from Word document.\nThe resume file exists and can be opened directly.\n\nError: ${docError instanceof Error ? docError.message : 'Unknown Word parsing error'}`;
        }
      
      case '.rtf':
        // RTF is essentially plain text with formatting codes, we can do basic extraction
        try {
          const rtfContent = await fs.readFile(filePath, 'utf-8');
          // Basic RTF text extraction - remove RTF control codes
          const plainText = rtfContent
            .replace(/\\[a-z]+[0-9]*\s?/gi, '') // Remove RTF control words
            .replace(/[{}]/g, '') // Remove braces
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
          return plainText || '[RTF Resume - No text content could be extracted]';
        } catch (rtfError) {
          console.warn('RTF extraction failed:', rtfError);
          return `[RTF Resume - ${filePath}]\n\nFailed to extract text from RTF file.\nThe resume file exists and can be opened directly.\n\nError: ${rtfError instanceof Error ? rtfError.message : 'Unknown RTF parsing error'}`;
        }
      
      default:
        return `[Unsupported file format - ${ext}]\n\nThis file type is not supported for text extraction.\nThe resume file exists and can be opened directly.`;
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    return `[Error extracting text from ${filePath}]\n\nAn error occurred while trying to extract text from this resume.\nThe resume file may still be accessible by opening it directly.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();
    
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return NextResponse.json(
        { error: 'File not found', filePath },
        { status: 404 }
      );
    }

    // Extract text from the file
    const extractedText = await extractTextFromFile(filePath);

    return NextResponse.json({
      success: true,
      filePath,
      text: extractedText,
      fileType: extname(filePath).toLowerCase()
    });

  } catch (error) {
    console.error('Resume text extraction error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to extract text from resume',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}