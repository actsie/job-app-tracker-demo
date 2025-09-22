export interface EmailTemplateData {
  company: string;
  role: string;
  applicationDate: string;
  recruiterName?: string;
  contactEmail?: string;
  customMessage?: string;
}

export interface EmailDraft {
  subject: string;
  body: string;
  to?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'standard-followup',
    name: 'Standard Follow-up',
    description: 'Professional follow-up for general applications',
    subject: 'Following up on my {{role}} application - {{company}}',
    body: `Dear{{#recruiterName}} {{recruiterName}}{{/recruiterName}}{{^recruiterName}} Hiring Manager{{/recruiterName}},

I hope this email finds you well. I am writing to follow up on my application for the {{role}} position at {{company}} that I submitted on {{applicationDate}}.

I remain very interested in this opportunity and would appreciate any updates you might have regarding the status of my application. I believe my skills and experience would be a valuable addition to your team, and I am excited about the possibility of contributing to {{company}}'s continued success.

{{#customMessage}}{{customMessage}}

{{/customMessage}}If you need any additional information from me or would like to schedule an interview, please don't hesitate to reach out. I look forward to hearing from you soon.

Thank you for your time and consideration.

Best regards,
[Your Name]
[Your Email]
[Your Phone Number]`
  },
  {
    id: 'brief-followup',
    name: 'Brief Follow-up',
    description: 'Concise follow-up for quick check-ins',
    subject: 'Quick follow-up: {{role}} application at {{company}}',
    body: `Dear{{#recruiterName}} {{recruiterName}}{{/recruiterName}}{{^recruiterName}} Hiring Manager{{/recruiterName}},

I wanted to briefly follow up on my application for the {{role}} position at {{company}} submitted on {{applicationDate}}.

{{#customMessage}}{{customMessage}}

{{/customMessage}}I remain very interested in this opportunity and would welcome any updates you might have.

Thank you for your time.

Best regards,
[Your Name]
[Your Email]`
  },
  {
    id: 'post-interview-followup',
    name: 'Post-Interview Follow-up',
    description: 'Follow-up after an interview or conversation',
    subject: 'Thank you for the {{role}} interview - {{company}}',
    body: `Dear{{#recruiterName}} {{recruiterName}}{{/recruiterName}}{{^recruiterName}} Hiring Manager{{/recruiterName}},

Thank you for taking the time to discuss the {{role}} position at {{company}} with me{{#applicationDate}} on {{applicationDate}}{{/applicationDate}}.

I enjoyed our conversation and am even more excited about the opportunity to contribute to {{company}}. The role aligns perfectly with my background and career goals.

{{#customMessage}}{{customMessage}}

{{/customMessage}}Please let me know if you need any additional information from me. I look forward to hearing about the next steps.

Best regards,
[Your Name]
[Your Email]
[Your Phone Number]`
  },
  {
    id: 'check-in-followup',
    name: 'Gentle Check-in',
    description: 'Polite check-in for applications without response',
    subject: 'Checking in on my {{role}} application - {{company}}',
    body: `Dear{{#recruiterName}} {{recruiterName}}{{/recruiterName}}{{^recruiterName}} Hiring Team{{/recruiterName}},

I hope you're doing well. I wanted to check in regarding my application for the {{role}} position at {{company}} that I submitted on {{applicationDate}}.

I understand that you're likely reviewing many applications, and I appreciate the time it takes for a thorough selection process. I remain very enthusiastic about this opportunity and {{company}}'s mission.

{{#customMessage}}{{customMessage}}

{{/customMessage}}If there's any additional information I can provide to support my candidacy, please let me know. I look forward to hearing from you when convenient.

Thank you for your consideration.

Warm regards,
[Your Name]
[Your Email]
[Your Phone Number]`
  }
];

// Maintain backward compatibility
export const DEFAULT_FOLLOW_UP_TEMPLATE = EMAIL_TEMPLATES[0].body;

export function processTemplate(template: string, data: EmailTemplateData): string {
  if (!template || typeof template !== 'string') {
    console.error('Invalid template provided to processTemplate:', template);
    return 'Template processing error: Invalid template';
  }

  if (!data || typeof data !== 'object') {
    console.error('Invalid data provided to processTemplate:', data);
    return 'Template processing error: Invalid data';
  }

  try {
    let processed = template;
    
    // Validate and sanitize data
    const safeData = {
      company: data.company || 'Unknown Company',
      role: data.role || 'Unknown Role',
      applicationDate: data.applicationDate || 'Unknown Date',
      recruiterName: data.recruiterName || '',
      contactEmail: data.contactEmail || '',
      customMessage: data.customMessage || ''
    };
    
    // Handle negative conditionals first ({{^field}}...{{/field}})
    processed = processed.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, field, content) => {
      try {
        const fieldValue = (safeData as any)[field];
        return (!fieldValue || fieldValue.trim() === '') ? content : '';
      } catch (error) {
        console.warn(`Error processing negative conditional for field ${field}:`, error);
        return '';
      }
    });
    
    // Handle positive conditionals ({{#field}}...{{/field}})
    processed = processed.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, field, content) => {
      try {
        const fieldValue = (safeData as any)[field];
        return (fieldValue && fieldValue.trim() !== '') ? content : '';
      } catch (error) {
        console.warn(`Error processing positive conditional for field ${field}:`, error);
        return '';
      }
    });
    
    // Replace simple placeholders
    Object.entries(safeData).forEach(([key, value]) => {
      try {
        if (value) {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          processed = processed.replace(regex, value);
        }
      } catch (error) {
        console.warn(`Error replacing placeholder ${key}:`, error);
      }
    });
    
    // Clean up any remaining empty placeholders
    processed = processed.replace(/\{\{\w+\}\}/g, '[PLACEHOLDER]');
    
    return processed.trim();
  } catch (error) {
    console.error('Template processing failed:', error);
    return `Template processing error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

export function generateEmailDraft(
  templateData: EmailTemplateData, 
  templateId: string = 'standard-followup'
): EmailDraft {
  try {
    if (!templateData) {
      console.error('No template data provided to generateEmailDraft');
      return {
        subject: 'Email Draft Error',
        body: 'Unable to generate email: Missing template data',
        to: ''
      };
    }

    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      console.warn(`Template not found: ${templateId}, falling back to default`);
      const defaultTemplate = EMAIL_TEMPLATES[0];
      if (!defaultTemplate) {
        console.error('No default template available');
        return {
          subject: 'Email Template Error',
          body: 'Unable to generate email: No templates available',
          to: templateData.contactEmail || ''
        };
      }
    }

    const selectedTemplate = template || EMAIL_TEMPLATES[0];
    
    const subject = processTemplate(selectedTemplate.subject, templateData);
    const body = processTemplate(selectedTemplate.body, templateData);

    // Validate the generated content
    if (!subject || subject.includes('Template processing error')) {
      console.warn('Subject generation failed, using fallback');
    }
    
    if (!body || body.includes('Template processing error')) {
      console.warn('Body generation failed, using fallback');
    }

    return {
      subject: subject || `Follow-up: ${templateData.role || 'Application'} at ${templateData.company || 'Company'}`,
      body: body || 'There was an error generating the email content. Please try again.',
      to: templateData.contactEmail || ''
    };
  } catch (error) {
    console.error('Email draft generation failed:', error);
    return {
      subject: 'Email Generation Error',
      body: 'An unexpected error occurred while generating the email draft. Please try again.',
      to: templateData?.contactEmail || ''
    };
  }
}

// Backward compatibility function
export function generateEmailDraftLegacy(templateData: EmailTemplateData): EmailDraft {
  return generateEmailDraft(templateData, 'standard-followup');
}

export function generateMailtoLink(draft: EmailDraft): string {
  try {
    const recipient = encodeURIComponent(draft.to || '');
    const subject = encodeURIComponent(draft.subject);
    const body = encodeURIComponent(draft.body);
    
    // Build the mailto URL
    let mailtoUrl = `mailto:${recipient}`;
    const params: string[] = [];
    
    if (draft.subject) {
      params.push(`subject=${subject}`);
    }
    
    if (draft.body) {
      params.push(`body=${body}`);
    }
    
    if (params.length > 0) {
      mailtoUrl += '?' + params.join('&');
    }
    
    // Check URL length limit (2000 characters for broad compatibility)
    if (mailtoUrl.length > 2000) {
      // Fallback: truncate the body to fit within limits
      const availableLength = 1800 - subject.length - recipient.length - 50; // Buffer for URL structure
      const truncatedBody = draft.body.substring(0, availableLength) + '\n\n[...Message truncated due to length limits. Please complete in your email client.]';
      const encodedTruncatedBody = encodeURIComponent(truncatedBody);
      
      const fallbackParams = [];
      if (draft.subject) {
        fallbackParams.push(`subject=${subject}`);
      }
      fallbackParams.push(`body=${encodedTruncatedBody}`);
      
      mailtoUrl = `mailto:${recipient}?${fallbackParams.join('&')}`;
    }
    
    return mailtoUrl;
  } catch (error) {
    // Fallback for encoding errors - create a basic mailto link
    console.warn('Error generating mailto link:', error);
    return `mailto:${draft.to || ''}?subject=${draft.subject}&body=${draft.body}`;
  }
}

export function copyEmailToClipboard(draft: EmailDraft): Promise<boolean> {
  const emailContent = `To: ${draft.to || '[Your recipient]'}\nSubject: ${draft.subject}\n\n${draft.body}`;
  
  return new Promise((resolve) => {
    if (navigator.clipboard && window.isSecureContext) {
      // Modern clipboard API
      navigator.clipboard.writeText(emailContent)
        .then(() => resolve(true))
        .catch(() => resolve(false));
    } else {
      // Fallback for older browsers or non-secure contexts
      try {
        const textArea = document.createElement('textarea');
        textArea.value = emailContent;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const result = document.execCommand('copy');
        document.body.removeChild(textArea);
        resolve(result);
      } catch (error) {
        console.warn('Clipboard fallback failed:', error);
        resolve(false);
      }
    }
  });
}

export function formatDateForTemplate(isoDateString: string): string {
  try {
    const date = new Date(isoDateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Recently'; // Fallback for invalid dates
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.warn('Error formatting date:', error);
    return 'Recently';
  }
}

export function getPlaceholderInfo(): { [key: string]: string } {
  return {
    company: 'Company name (auto-filled from application)',
    role: 'Job title/position (auto-filled from application)', 
    applicationDate: 'Date you applied (auto-filled from application)',
    recruiterName: 'Recruiter or hiring manager name (optional)',
    contactEmail: 'Recipient email address (optional)',
    customMessage: 'Additional personalized message (optional)'
  };
}

export function validateEmailDraft(draft: EmailDraft): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!draft.subject || draft.subject.trim().length === 0) {
    errors.push('Subject line is required');
  }
  
  if (!draft.body || draft.body.trim().length === 0) {
    errors.push('Email body is required');
  }
  
  // Check for unresolved placeholders
  if (draft.subject.includes('[PLACEHOLDER]') || draft.body.includes('[PLACEHOLDER]')) {
    errors.push('Some placeholders could not be resolved - please check your template data');
  }
  
  // Check email format if recipient is provided
  if (draft.to && !isValidEmail(draft.to)) {
    errors.push('Recipient email address format is invalid');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export { EMAIL_TEMPLATES as AVAILABLE_TEMPLATES };