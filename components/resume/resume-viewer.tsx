'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Download, Eye, AlertCircle, ExternalLink } from 'lucide-react';
import { ResumeManifestEntry } from '@/lib/types';
import { detectFileKind, getFileKindDisplayInfo } from '@/utils/files';

interface ResumeViewerProps {
  resume: ResumeManifestEntry;
  className?: string;
}

export function ResumeViewer({ resume, className }: ResumeViewerProps) {
  const [activeTab, setActiveTab] = useState('original');
  const [localResume, setLocalResume] = useState(resume);
  const activeVersion = localResume.versions?.find(v => v.is_active);

  // Sync with prop changes
  useEffect(() => {
    setLocalResume(resume);
  }, [resume]);

  // Poll for extraction updates if extraction is pending
  useEffect(() => {
    if (activeVersion?.extraction_status === 'pending') {
      const checkExtraction = async () => {
        try {
          const response = await fetch(`/api/resume/manifest?resumeId=${localResume.id}`);
          if (response.ok) {
            const updatedResume = await response.json();
            setLocalResume(updatedResume);
          }
        } catch (error) {
          console.warn('Failed to check extraction status:', error);
        }
      };

      const interval = setInterval(checkExtraction, 2000);
      return () => clearInterval(interval);
    }
  }, [localResume.id, activeVersion?.extraction_status]);
  
  if (!activeVersion) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-gray-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>No active resume version found</p>
        </CardContent>
      </Card>
    );
  }

  const hasExtractedText = activeVersion.extracted_text && activeVersion.extraction_status === 'success';
  const extractionFailed = activeVersion.extraction_status === 'failed';
  
  // Use robust file type detection
  const fileKind = detectFileKind({
    contentType: activeVersion.mime_type,
    extension: localResume.file_extension,
  });
  const displayInfo = getFileKindDisplayInfo(fileKind);
  const isPdf = fileKind === 'pdf';

  const handleDownload = () => {
    if (activeVersion.managed_path) {
      window.open(`/api/resume/download?path=${encodeURIComponent(activeVersion.managed_path)}`, '_blank');
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Resume Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayInfo.userMessage && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">{displayInfo.userMessage}</p>
          </div>
        )}
        
        {displayInfo.showPreviewTab && displayInfo.showOriginalTab ? (
          // Both tabs visible (for "other" file types)
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preview" disabled={!hasExtractedText && !extractionFailed}>
                {displayInfo.previewTabLabel} {!hasExtractedText && !extractionFailed && '(Loading...)'}
              </TabsTrigger>
              <TabsTrigger value="original">
                {displayInfo.originalTabLabel}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="preview" className="mt-4">
              {hasExtractedText ? (
                <div className="w-full border rounded-md p-4 max-h-none overflow-visible">
                  <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                    {activeVersion.extracted_text}
                  </pre>
                </div>
              ) : extractionFailed ? (
                <div className="p-6 text-center border rounded-md bg-red-50">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                  <p className="text-red-700 font-medium mb-2">Text Extraction Failed</p>
                  <p className="text-sm text-red-600 mb-4">
                    {activeVersion.extraction_error || 'Could not extract text from this file.'}
                  </p>
                  <Button onClick={() => setActiveTab('original')} variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    View Original File
                  </Button>
                </div>
              ) : (
                <div className="p-6 text-center border rounded-md">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">Extracting text...</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="original" className="mt-4">
              {isPdf ? (
                <div className="border rounded-md">
                  <embed
                    src={`/api/resume/view?path=${encodeURIComponent(activeVersion.managed_path)}`}
                    type="application/pdf"
                    width="100%"
                    height="500px"
                    className="rounded-md"
                  />
                </div>
              ) : (
                <div className="p-6 text-center border rounded-md">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 mb-4">
                    {localResume.base_filename}{localResume.file_extension}
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    This file type cannot be previewed in the browser.
                  </p>
                  <Button onClick={handleDownload} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download to View
                  </Button>
                </div>
              )}
              
              <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t">
                <span>
                  Version: {activeVersion.version_suffix || 'Original'} • 
                  Uploaded: {new Date(activeVersion.upload_timestamp).toLocaleDateString()}
                </span>
                <Button onClick={handleDownload} variant="ghost" size="sm">
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        ) : displayInfo.showPreviewTab ? (
          // Only preview tab (DOCX files)
          <div className="w-full">
            {hasExtractedText ? (
              <div className="w-full border rounded-md p-4 max-h-none overflow-visible">
                <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                  {activeVersion.extracted_text}
                </pre>
              </div>
            ) : extractionFailed ? (
              <div className="p-6 text-center border rounded-md bg-red-50">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                <p className="text-red-700 font-medium mb-2">Text Extraction Failed</p>
                <p className="text-sm text-red-600 mb-4">
                  {activeVersion.extraction_error || 'Could not extract text from this DOCX file.'}
                </p>
                <div className="space-y-2">
                  <Button onClick={handleDownload} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download Original DOCX
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center border rounded-md">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">Extracting text from DOCX...</p>
              </div>
            )}
            
            <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t mt-4">
              <span>
                Version: {activeVersion.version_suffix || 'Original'} • 
                Uploaded: {new Date(activeVersion.upload_timestamp).toLocaleDateString()}
              </span>
              <Button onClick={handleDownload} variant="ghost" size="sm">
                <Download className="h-3 w-3 mr-1" />
                Download Original
              </Button>
            </div>
          </div>
        ) : (
          // Only original tab (PDF files)
          <div className="w-full">
            {isPdf ? (
              <>
                <div className="border rounded-md">
                  <embed
                    src={`/api/resume/view?path=${encodeURIComponent(activeVersion.managed_path)}`}
                    type="application/pdf"
                    width="100%"
                    height="500px"
                    className="rounded-md"
                    onError={() => {
                      // Fallback if PDF embed fails
                      console.warn('PDF embed failed, showing fallback UI');
                    }}
                  />
                </div>
                
                <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t mt-4">
                  <span>
                    Version: {activeVersion.version_suffix || 'Original'} • 
                    Uploaded: {new Date(activeVersion.upload_timestamp).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => {
                        // Open in system viewer as fallback
                        fetch('/api/file-actions/open', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ filePath: activeVersion.managed_path })
                        });
                      }}
                      variant="ghost" 
                      size="sm"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open in Viewer
                    </Button>
                    <Button onClick={handleDownload} variant="ghost" size="sm">
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 text-center border rounded-md">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-4">
                  {localResume.base_filename}{localResume.file_extension}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  This file type cannot be previewed in the browser.
                </p>
                <Button onClick={handleDownload} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download to View
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}