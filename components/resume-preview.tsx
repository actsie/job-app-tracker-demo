'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import PDF components to avoid SSR issues
const Document = dynamic(() => import('react-pdf').then(mod => ({ default: mod.Document })), {
  ssr: false,
  loading: () => <div className="animate-pulse">Loading PDF...</div>
});
const Page = dynamic(() => import('react-pdf').then(mod => ({ default: mod.Page })), {
  ssr: false
});
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, FileText, AlertCircle, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ResumePreviewProps {
  filePath: string;
  filename?: string;
  height?: number | string;
  showControls?: boolean;
  className?: string;
  onError?: (error: string) => void;
}

export function ResumePreview({ 
  filePath, 
  filename, 
  height = 600, 
  showControls = true,
  className = '',
  onError 
}: ResumePreviewProps) {
  const [previewMode, setPreviewMode] = useState<'embed' | 'pdf-js' | 'text' | 'error'>('embed');
  const [extractedText, setExtractedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [error, setError] = useState<string>('');
  const { toast } = useToast();

  const fileExtension = filePath.split('.').pop()?.toLowerCase();
  const isPdf = fileExtension === 'pdf';
  const isDocx = fileExtension === 'docx' || fileExtension === 'doc';
  
  useEffect(() => {
    // Configure pdf.js worker
    if (typeof window !== 'undefined') {
      import('pdfjs-dist').then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      });
    }
    
    initializePreview();
  }, [filePath]);

  const initializePreview = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      if (isPdf) {
        // For PDF files, try embed first
        setPreviewMode('embed');
      } else if (isDocx) {
        // For DOCX files, extract text directly
        await extractTextContent();
      } else {
        // For other files, try embed
        setPreviewMode('embed');
      }
    } catch (err) {
      handleError('Failed to initialize preview', err);
    } finally {
      setIsLoading(false);
    }
  };

  const extractTextContent = async () => {
    try {
      const response = await fetch('/api/resume/extract-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });

      if (response.ok) {
        const data = await response.json();
        setExtractedText(data.text || 'No text content found');
        setPreviewMode('text');
      } else {
        throw new Error('Failed to extract text');
      }
    } catch (err) {
      handleError('Failed to extract text from document', err);
    }
  };

  const handleError = (message: string, err?: any) => {
    console.error(message, err);
    const errorMessage = err instanceof Error ? err.message : message;
    setError(errorMessage);
    setPreviewMode('error');
    onError?.(errorMessage);
    
    toast({
      title: "Preview Error",
      description: message,
      variant: "destructive",
    });
  };

  const handleEmbedError = () => {
    if (isPdf) {
      // Fallback to pdf.js for PDFs
      setPreviewMode('pdf-js');
    } else {
      handleError('Failed to load file preview');
    }
  };

  const handlePdfLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
  };

  const handlePdfLoadError = (error: any) => {
    console.error('PDF.js error:', error);
    // Final fallback to text extraction
    extractTextContent();
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/resume/view?path=${encodeURIComponent(filePath)}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'resume';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Failed to download file');
      }
    } catch (err) {
      toast({
        title: "Download Failed",
        description: "Could not download the file",
        variant: "destructive",
      });
    }
  };

  const goToPrevPage = () => setPageNumber(page => Math.max(1, page - 1));
  const goToNextPage = () => setPageNumber(page => Math.min(numPages, page + 1));

  const renderPreviewContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400 animate-pulse" />
            <p className="text-sm text-gray-500">Loading preview...</p>
          </div>
        </div>
      );
    }

    switch (previewMode) {
      case 'embed':
        return (
          <embed
            src={`/api/resume/view?path=${encodeURIComponent(filePath)}`}
            type={isPdf ? 'application/pdf' : 'application/octet-stream'}
            width="100%"
            height="100%"
            onError={handleEmbedError}
          />
        );

      case 'pdf-js':
        return (
          <div className="h-full flex flex-col">
            {showControls && numPages > 1 && (
              <div className="flex items-center justify-center gap-4 p-2 border-b">
                <Button size="sm" variant="outline" onClick={goToPrevPage} disabled={pageNumber <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {pageNumber} of {numPages}
                </span>
                <Button size="sm" variant="outline" onClick={goToNextPage} disabled={pageNumber >= numPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex-1 flex items-center justify-center overflow-auto">
              <Document
                file={`/api/resume/view?path=${encodeURIComponent(filePath)}`}
                onLoadSuccess={handlePdfLoadSuccess}
                onLoadError={handlePdfLoadError}
                loading={
                  <div className="text-center">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400 animate-pulse" />
                    <p className="text-sm text-gray-500">Loading PDF...</p>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  scale={1.0}
                  className="shadow-lg"
                />
              </Document>
            </div>
          </div>
        );

      case 'text':
        return (
          <div className="h-full overflow-auto p-4 bg-gray-50">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
              {extractedText}
            </pre>
          </div>
        );

      case 'error':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Not Available</h3>
              <p className="text-sm text-gray-500 mb-4">
                {error || 'Unable to preview this file. You can download it to view in your system viewer.'}
              </p>
              <Button onClick={handleDownload} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download File
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={className}>
      {showControls && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {filename || 'Resume Preview'}
            </CardTitle>
            <div className="flex gap-2">
              {isPdf && previewMode === 'embed' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPreviewMode('pdf-js')}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  PDF Viewer
                </Button>
              )}
              {isPdf && previewMode === 'pdf-js' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPreviewMode('embed')}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Embed View
                </Button>
              )}
              {(isDocx || isPdf) && previewMode !== 'text' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={extractTextContent}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Text View
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <div style={{ height: typeof height === 'number' ? `${height}px` : height }}>
          {renderPreviewContent()}
        </div>
      </CardContent>
    </Card>
  );
}