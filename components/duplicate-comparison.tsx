'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { DuplicateGroup, JobDescription } from '@/lib/types';
import { 
  Merge, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Calendar,
  ExternalLink,
  FileText
} from 'lucide-react';

interface DuplicateComparisonProps {
  group: DuplicateGroup;
  onMerge: (primaryUuid: string, duplicateUuids: string[]) => void;
  onDelete: (uuid: string) => void;
  onClose: () => void;
}

export function DuplicateComparison({ group, onMerge, onDelete, onClose }: DuplicateComparisonProps) {
  const [selectedPrimary, setSelectedPrimary] = useState(group.primary_job.uuid);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());

  const allJobs = [group.primary_job, ...group.duplicates.map(d => d.job_description)];

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSimilarityScore = (jobUuid: string) => {
    const duplicate = group.duplicates.find(d => d.job_description.uuid === jobUuid);
    return duplicate ? duplicate.similarity_score : 1.0; // Primary job has 100% similarity to itself
  };

  const formatSimilarityPercentage = (score: number) => {
    return `${(score * 100).toFixed(1)}%`;
  };

  const toggleDeletionSelection = (uuid: string) => {
    const newSelection = new Set(selectedForDeletion);
    if (newSelection.has(uuid)) {
      newSelection.delete(uuid);
    } else {
      newSelection.add(uuid);
    }
    setSelectedForDeletion(newSelection);
  };

  const handleKeepBoth = () => {
    onClose();
  };

  const handleMerge = () => {
    const duplicateUuids = allJobs
      .filter(job => job.uuid !== selectedPrimary)
      .filter(job => !selectedForDeletion.has(job.uuid))
      .map(job => job.uuid);
    
    if (duplicateUuids.length > 0) {
      onMerge(selectedPrimary, duplicateUuids);
    }
  };

  const handleDeleteSelected = async () => {
    for (const uuid of selectedForDeletion) {
      await onDelete(uuid);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
        <div className="text-sm">
          <strong>Primary:</strong> {allJobs.find(j => j.uuid === selectedPrimary)?.company || 'Unknown'} - {allJobs.find(j => j.uuid === selectedPrimary)?.role || 'Unknown'}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleKeepBoth}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Keep Both
          </Button>
          <Button 
            onClick={handleMerge}
            disabled={allJobs.filter(job => job.uuid !== selectedPrimary && !selectedForDeletion.has(job.uuid)).length === 0}
          >
            <Merge className="h-4 w-4 mr-2" />
            Merge Selected
          </Button>
          <Button 
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={selectedForDeletion.size === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected ({selectedForDeletion.size})
          </Button>
        </div>
      </div>

      {/* Job Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
        {allJobs.map((job, index) => {
          const isPrimary = job.uuid === selectedPrimary;
          const isSelected = selectedForDeletion.has(job.uuid);
          const similarityScore = getSimilarityScore(job.uuid);

          return (
            <Card 
              key={job.uuid} 
              className={`${isPrimary ? 'border-blue-500 bg-blue-50' : ''} ${isSelected ? 'border-red-500 bg-red-50' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">
                      {job.company || 'Unknown Company'}
                    </CardTitle>
                    {isPrimary && (
                      <Badge variant="default" className="text-xs">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <Badge 
                    variant={similarityScore >= 0.95 ? "destructive" : similarityScore >= 0.85 ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {formatSimilarityPercentage(similarityScore)}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">
                    <strong>Role:</strong> {job.role || 'Unknown Role'}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(job.fetched_at_iso)}
                    </div>
                    {job.source_url && (
                      <div className="flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        <a 
                          href={job.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          Source
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {job.capture_method}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Job Description Text
                    </label>
                    <Textarea
                      value={job.jd_text}
                      readOnly
                      className="min-h-[200px] text-xs"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t">
                    <div className="flex gap-2">
                      <Button
                        variant={isPrimary ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedPrimary(job.uuid)}
                        disabled={isSelected}
                      >
                        Set as Primary
                      </Button>
                    </div>
                    
                    <Button
                      variant={isSelected ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => toggleDeletionSelection(job.uuid)}
                      disabled={isPrimary}
                    >
                      {isSelected ? (
                        <>
                          <XCircle className="h-4 w-4 mr-1" />
                          Unselect
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Mark for Deletion
                        </>
                      )}
                    </Button>
                  </div>

                  {job.merged_from && job.merged_from.length > 0 && (
                    <div className="p-2 bg-blue-50 rounded border text-xs">
                      <strong>Previously merged from:</strong> {job.merged_from.length} job(s)
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      <div className="p-4 bg-gray-50 rounded-lg text-sm">
        <strong>Action Summary:</strong>
        <ul className="mt-2 space-y-1">
          <li>• <strong>Primary job:</strong> {allJobs.find(j => j.uuid === selectedPrimary)?.company} - {allJobs.find(j => j.uuid === selectedPrimary)?.role}</li>
          <li>• <strong>Jobs to merge:</strong> {allJobs.filter(job => job.uuid !== selectedPrimary && !selectedForDeletion.has(job.uuid)).length}</li>
          <li>• <strong>Jobs to delete:</strong> {selectedForDeletion.size}</li>
        </ul>
      </div>
    </div>
  );
}