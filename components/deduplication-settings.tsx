'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DeduplicationConfig } from '@/lib/types';
import { useToast } from '@/components/ui/use-toast';

interface DeduplicationSettingsProps {
  config: DeduplicationConfig;
  onConfigUpdate: (config: DeduplicationConfig) => void;
}

export function DeduplicationSettings({ config, onConfigUpdate }: DeduplicationSettingsProps) {
  const [localConfig, setLocalConfig] = useState<DeduplicationConfig>(config);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/deduplication/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localConfig),
      });

      if (!response.ok) {
        throw new Error(`Failed to save config: ${response.statusText}`);
      }

      onConfigUpdate(localConfig);
      toast({
        title: "Settings Saved",
        description: "Deduplication settings have been updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleComparisonField = (field: 'jd_text' | 'company' | 'role') => {
    const newFields = localConfig.comparison_fields.includes(field)
      ? localConfig.comparison_fields.filter(f => f !== field)
      : [...localConfig.comparison_fields, field];
    
    setLocalConfig({ ...localConfig, comparison_fields: newFields });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Similarity Detection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Similarity Threshold ({(localConfig.similarity_threshold * 100).toFixed(0)}%)
            </label>
            <Input
              type="range"
              min="0.5"
              max="1.0"
              step="0.05"
              value={localConfig.similarity_threshold}
              onChange={(e) => setLocalConfig({
                ...localConfig,
                similarity_threshold: parseFloat(e.target.value)
              })}
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">
              Jobs with similarity above this threshold will be flagged as duplicates
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Auto-merge Threshold ({(localConfig.auto_merge_threshold * 100).toFixed(0)}%)
            </label>
            <Input
              type="range"
              min="0.8"
              max="1.0"
              step="0.05"
              value={localConfig.auto_merge_threshold}
              onChange={(e) => setLocalConfig({
                ...localConfig,
                auto_merge_threshold: parseFloat(e.target.value)
              })}
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">
              Jobs with similarity above this threshold could be automatically merged (future feature)
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Comparison Fields
            </label>
            <div className="flex flex-wrap gap-2">
              {(['jd_text', 'company', 'role'] as const).map((field) => {
                const isSelected = localConfig.comparison_fields.includes(field);
                const labels = {
                  jd_text: 'Job Description Text',
                  company: 'Company Name',
                  role: 'Job Role'
                };
                
                return (
                  <Badge
                    key={field}
                    variant={isSelected ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => toggleComparisonField(field)}
                  >
                    {labels[field]}
                  </Badge>
                );
              })}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Select which fields to compare when detecting duplicates
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Automated Processing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="schedule_enabled"
              checked={localConfig.schedule_enabled}
              onChange={(e) => setLocalConfig({
                ...localConfig,
                schedule_enabled: e.target.checked
              })}
              className="rounded"
            />
            <label htmlFor="schedule_enabled" className="text-sm font-medium">
              Enable scheduled deduplication
            </label>
          </div>

          {localConfig.schedule_enabled && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Schedule Interval (minutes)
              </label>
              <Input
                type="number"
                min="15"
                max="1440"
                step="15"
                value={localConfig.schedule_interval}
                onChange={(e) => setLocalConfig({
                  ...localConfig,
                  schedule_interval: parseInt(e.target.value) || 60
                })}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">
                How often to automatically scan for duplicates (15 minutes to 24 hours)
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={() => setLocalConfig(config)}>
          Reset
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}