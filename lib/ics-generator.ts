/**
 * ICS (iCalendar) file generator for reminder exports
 * Creates calendar events that can be imported into Google Calendar, Outlook, etc.
 */

interface ICSEventParams {
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  url?: string;
  reminderMinutes?: number;
  uid?: string;
}

/**
 * Format date to ICS format (YYYYMMDDTHHMMSSZ)
 */
function formatDateToICS(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape special characters for ICS format
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

/**
 * Fold long lines according to ICS spec (max 75 chars per line)
 */
function foldICSLine(line: string): string {
  if (line.length <= 75) return line;
  
  const lines = [];
  let start = 0;
  
  while (start < line.length) {
    if (start === 0) {
      lines.push(line.substring(0, 75));
      start = 75;
    } else {
      lines.push(' ' + line.substring(start, start + 74));
      start += 74;
    }
  }
  
  return lines.join('\r\n');
}

/**
 * Generate ICS file content for a reminder
 */
export function generateICS(params: ICSEventParams): string {
  const {
    title,
    description,
    startDate,
    endDate = new Date(startDate.getTime() + 30 * 60 * 1000), // Default 30 minutes duration
    location = '',
    url = '',
    reminderMinutes = 15,
    uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@jobtracker.app`
  } = params;

  const now = new Date();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Job Application Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatDateToICS(now)}`,
    `DTSTART:${formatDateToICS(startDate)}`,
    `DTEND:${formatDateToICS(endDate)}`,
    `SUMMARY:${escapeICSText(title)}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeICSText(description)}`);
  }

  if (location) {
    lines.push(`LOCATION:${escapeICSText(location)}`);
  }

  if (url) {
    lines.push(`URL:${url}`);
  }

  // Add reminder/alarm
  lines.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:-PT${reminderMinutes}M`,
    `DESCRIPTION:${escapeICSText(title)}`,
    'END:VALARM'
  );

  lines.push(
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  );

  // Apply line folding and join with CRLF
  return lines
    .map(line => foldICSLine(line))
    .join('\r\n');
}

/**
 * Generate ICS file for a job application reminder
 */
export function generateJobReminderICS(
  company: string,
  role: string,
  reminderDate: Date,
  message: string,
  jobUrl?: string | null,
  jobUUID?: string
): string {
  const title = `Follow up: ${role} at ${company}`;
  const description = [
    message,
    '',
    `Job: ${role}`,
    `Company: ${company}`,
    jobUrl ? `Application URL: ${jobUrl}` : '',
    '',
    'This reminder was created by Job Application Tracker'
  ].filter(Boolean).join('\\n');

  return generateICS({
    title,
    description,
    startDate: reminderDate,
    url: jobUrl || undefined,
    uid: jobUUID ? `reminder-${jobUUID}@jobtracker.app` : undefined
  });
}

/**
 * Trigger download of ICS file
 */
export function downloadICS(content: string, filename: string = 'reminder.ics'): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}