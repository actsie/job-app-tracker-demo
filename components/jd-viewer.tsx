'use client';

import { useState, useEffect } from 'react';
import { JobDescription } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { 
  FileText, 
  ExternalLink, 
  Calendar, 
  Building, 
  Briefcase, 
  Globe, 
  Copy,
  Download,
  Eye
} from 'lucide-react';

interface JDViewerProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobDescription;
}

interface JobFiles {
  hasJsonFile: boolean;
  hasTxtFile: boolean;
  hasHtmlFile: boolean;
  hasSnapshotFile: boolean;
  jsonPath?: string;
  txtPath?: string;
  htmlPath?: string;
  snapshotPath?: string;
}

export function JDViewer({ isOpen, onClose, job }: JDViewerProps) {
  const [jobFiles, setJobFiles] = useState<JobFiles | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('text');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && job) {
      loadJobFiles();
    }
  }, [isOpen, job]);

  const loadJobFiles = async () => {
    setIsLoading(true);
    try {
      // Debug logging
      console.log('🐛 JD Viewer Loading Data:', {
        jobUuid: job.uuid,
        jdText: job.jd_text,
        sourceUrl: job.source_url,
        fullJob: job
      });

      const response = await fetch(`/api/jobs/${job.uuid}/files`);
      if (response.ok) {
        const files = await response.json();
        setJobFiles(files);
        
        // Set default tab based on available files
        if (files.hasTxtFile) {
          setSelectedTab('text');
        } else if (files.hasJsonFile) {
          setSelectedTab('structured');
        } else if (files.hasHtmlFile) {
          setSelectedTab('original');
        } else {
          setSelectedTab('text');
        }
      } else {
        // Fallback if API doesn't exist yet
        setJobFiles({
          hasJsonFile: true,
          hasTxtFile: true,
          hasHtmlFile: false,
          hasSnapshotFile: false
        });
      }
    } catch (error) {
      console.warn('Failed to load job files, using fallback:', error);
      setJobFiles({
        hasJsonFile: true,
        hasTxtFile: true,
        hasHtmlFile: false,
        hasSnapshotFile: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copied!",
        description: "Content copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy content to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleDownloadFile = async (fileType: 'json' | 'txt' | 'html' | 'snapshot') => {
    try {
      const response = await fetch(`/api/jobs/${job.uuid}/download?type=${fileType}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${job.company}_${job.role}_${job.uuid.slice(0, 8)}.${fileType === 'json' ? 'json' : fileType === 'txt' ? 'txt' : fileType === 'html' ? 'html' : 'png'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Downloaded",
          description: `${fileType.toUpperCase()} file downloaded`,
        });
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: JobDescription['application_status']) => {
    switch (status) {
      case 'applied': return 'bg-blue-100 text-blue-800';
      case 'interviewing': return 'bg-yellow-100 text-yellow-800';
      case 'offer': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'withdrawn': return 'bg-gray-100 text-gray-800';
      default: return 'bg-purple-100 text-purple-800';
    }
  };

  const getCaptureMethodIcon = (method?: string) => {
    switch (method) {
      case 'url_fetch': return <Globe className="h-4 w-4" />;
      case 'browser_helper': return <ExternalLink className="h-4 w-4" />;
      case 'manual': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  if (!job) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Job Description: {job.company} - {job.role}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Job Metadata */}
          <div className="p-4 bg-gray-50 border-b space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-gray-500" />
                  <span className="font-semibold">{job.company}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-gray-500" />
                  <span>{job.role}</span>
                </div>
                <Badge className={getStatusColor(job.application_status)}>
                  {job.application_status || 'interested'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {job.source_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a href={job.source_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Original Post
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="font-medium">Applied</div>
                  <div className="text-gray-600">
                    {formatDate(job.applied_date || job.fetched_at_iso)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getCaptureMethodIcon(job.capture_method)}
                <div>
                  <div className="font-medium">Captured Via</div>
                  <div className="text-gray-600 capitalize">
                    {job.capture_method === 'url_fetch' ? 'URL Fetch' : 
                     job.capture_method === 'browser_helper' ? 'Browser Helper' : 
                     'Manual Entry'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="font-medium">Last Updated</div>
                  <div className="text-gray-600">
                    {formatDate(job.last_updated || job.fetched_at_iso)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* File Content Tabs */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-4 mx-4 mt-4 flex-shrink-0">
                <TabsTrigger value="text" disabled={!jobFiles?.hasTxtFile && !job.jd_text}>
                  <FileText className="h-4 w-4 mr-2" />
                  Text View
                </TabsTrigger>
                <TabsTrigger value="structured" disabled={!jobFiles?.hasJsonFile}>
                  <FileText className="h-4 w-4 mr-2" />
                  Structured Data
                </TabsTrigger>
                <TabsTrigger value="original" disabled={!jobFiles?.hasHtmlFile}>
                  <Globe className="h-4 w-4 mr-2" />
                  Original HTML
                </TabsTrigger>
                <TabsTrigger value="snapshot" disabled={!jobFiles?.hasSnapshotFile}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Screenshot
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden px-4 pb-4 min-h-0">
                <TabsContent value="text" className="h-full m-0">
                  <div className="h-full flex flex-col border rounded-md min-h-0">
                    <div className="flex items-center justify-between p-3 border-b bg-gray-50 flex-shrink-0">
                      <span className="text-sm font-medium">Job Description Text</span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyToClipboard(job.jd_text)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </Button>
                        {jobFiles?.hasTxtFile && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadFile('txt')}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 p-4 overflow-auto min-h-0">
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                        {job.jd_text || 'No job description text available'}
                      </pre>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="structured" className="h-full m-0">
                  <div className="h-full flex flex-col border rounded-md min-h-0">
                    <div className="flex items-center justify-between p-3 border-b bg-gray-50 flex-shrink-0">
                      <span className="text-sm font-medium">Structured Data (JSON)</span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyToClipboard(JSON.stringify(job, null, 2))}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </Button>
                        {jobFiles?.hasJsonFile && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadFile('json')}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 p-4 overflow-auto min-h-0">
                      <pre className="text-xs font-mono bg-gray-50 p-3 rounded whitespace-pre-wrap">
                        {JSON.stringify(job, null, 2)}
                      </pre>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="original" className="h-full m-0">
                  <div className="h-full flex flex-col border rounded-md min-h-0">
                    <div className="flex items-center justify-between p-3 border-b bg-gray-50 flex-shrink-0">
                      <span className="text-sm font-medium">Original HTML Source</span>
                      <div className="flex gap-2">
                        {jobFiles?.hasHtmlFile && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadFile('html')}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 p-4 overflow-auto min-h-0">
                      <div className="text-center py-8 text-gray-500">
                        <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Original HTML content would be displayed here</p>
                        <p className="text-sm">This feature requires the job files API to be fully implemented</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="snapshot" className="h-full m-0">
                  <div className="h-full flex flex-col border rounded-md min-h-0">
                    <div className="flex items-center justify-between p-3 border-b bg-gray-50 flex-shrink-0">
                      <span className="text-sm font-medium">Job Posting Screenshot</span>
                      <div className="flex gap-2">
                        {jobFiles?.hasSnapshotFile && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadFile('snapshot')}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 p-4 overflow-auto min-h-0">
                      <div className="text-center py-8 text-gray-500">
                        <ExternalLink className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Job posting screenshot would be displayed here</p>
                        <p className="text-sm">This feature requires screenshot capture to be implemented</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default JDViewer;