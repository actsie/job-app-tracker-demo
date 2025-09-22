'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JobDescription, UnassignedResumeEntry } from '@/lib/types';
import { 
  Lightbulb,
  Building2,
  Briefcase,
  FileText,
  X
} from 'lucide-react';

interface FilenameHintsProps {
  resume: UnassignedResumeEntry;
  onClose: () => void;
}

interface FilenameHint {
  company: string;
  role: string;
  suggestedFilename: string;
  jobUuid: string;
}

export function FilenameHints({ resume, onClose }: FilenameHintsProps) {
  const [hints, setHints] = useState<FilenameHint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadHints();
  }, [resume]);

  const loadHints = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/jobs');
      if (response.ok) {
        const data = await response.json();
        const jobs: JobDescription[] = data.jobs || [];
        
        // Generate filename hints from recent jobs
        const recentJobs = jobs
          .filter(job => job.company && job.role)
          .sort((a, b) => new Date(b.fetched_at_iso).getTime() - new Date(a.fetched_at_iso).getTime())
          .slice(0, 5);

        const generatedHints: FilenameHint[] = recentJobs.map(job => {
          const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');
          const date = new Date().toISOString().split('T')[0];
          const fileExtension = resume.file_extension;
          
          return {
            company: job.company!,
            role: job.role!,
            suggestedFilename: `${sanitize(job.company!)}_${sanitize(job.role!)}_${date}${fileExtension}`,
            jobUuid: job.uuid
          };
        });

        setHints(generatedHints);
      }
    } catch (error) {
      console.error('Failed to load filename hints:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeCurrentFilename = () => {
    const filename = resume.filename.toLowerCase();
    const suggestions = [];

    // Look for common patterns
    if (filename.includes('resume') || filename.includes('cv')) {
      suggestions.push("Consider adding company/role to the filename for better organization");
    }

    if (filename.includes('updated') || filename.includes('new') || filename.includes('latest')) {
      suggestions.push("Generic terms like 'updated' or 'new' may become outdated");
    }

    if (filename.match(/\d{4}/)) {
      suggestions.push("Date found - consider using YYYY-MM-DD format for consistent sorting");
    }

    const parts = filename.split(/[-_\s]/);
    if (parts.length < 3) {
      suggestions.push("Consider format: Company_Role_Date for consistent organization");
    }

    return suggestions;
  };

  const currentFilenameAnalysis = analyzeCurrentFilename();

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            <h3 className="font-medium text-yellow-800">Filename Organization Hints</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-yellow-600 hover:bg-yellow-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Current Filename Analysis */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Current: {resume.filename}</span>
            </div>
            
            {currentFilenameAnalysis.length > 0 && (
              <div className="ml-6 space-y-1">
                {currentFilenameAnalysis.map((suggestion, index) => (
                  <p key={index} className="text-xs text-gray-600">• {suggestion}</p>
                ))}
              </div>
            )}
          </div>

          {/* Suggested Patterns */}
          {hints.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">
                Suggested patterns based on your recent jobs:
              </h4>
              <div className="space-y-2">
                {hints.map((hint, index) => (
                  <div key={index} className="bg-white rounded-lg p-3 border border-yellow-200">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium">{hint.company}</span>
                      <Briefcase className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{hint.role}</span>
                    </div>
                    <div className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">
                      {hint.suggestedFilename}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best Practices */}
          <div className="space-y-2 pt-3 border-t border-yellow-200">
            <h4 className="text-sm font-medium text-gray-700">Best practices:</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <p>• Use consistent format: Company_Role_Date</p>
              <p>• Avoid special characters and spaces</p>
              <p>• Include date (YYYY-MM-DD) for version tracking</p>
              <p>• Keep company and role names concise but clear</p>
            </div>
          </div>

          <div className="text-xs text-gray-500 italic">
            These are suggestions only - you can organize files however you prefer.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}