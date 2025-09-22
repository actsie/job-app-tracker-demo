export function generateGoogleCalendarUrl(params: {
  title: string;
  startDate: Date;
  endDate?: Date;
  details?: string;
  location?: string;
}): string {
  const { title, startDate, endDate, details, location } = params;
  
  // Format dates to Google Calendar format (YYYYMMDDTHHmmssZ)
  const formatDate = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  };
  
  // If no end date provided, make it 30 minutes after start
  const actualEndDate = endDate || new Date(startDate.getTime() + 30 * 60 * 1000);
  
  const queryParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatDate(startDate)}/${formatDate(actualEndDate)}`,
  });
  
  if (details) {
    queryParams.append('details', details);
  }
  
  if (location) {
    queryParams.append('location', location);
  }
  
  return `https://calendar.google.com/calendar/render?${queryParams.toString()}`;
}

export function generateJobReminderGoogleUrl(
  company: string,
  role: string,
  reminderDate: Date,
  jobUrl?: string,
  jobUUID?: string,
  reminderMessage?: string
): string {
  const title = `Follow up: ${company} - ${role}`;
  
  const detailsLines = [
    `Company: ${company}`,
    `Role: ${role}`,
  ];
  
  if (reminderMessage) {
    detailsLines.push(`\nNote: ${reminderMessage}`);
  }
  
  if (jobUUID) {
    detailsLines.push(`\nTracker ID: ${jobUUID}`);
  }
  
  if (jobUrl) {
    detailsLines.push(`\nJob posting: ${jobUrl}`);
  }
  
  const details = detailsLines.join('\n');
  
  return generateGoogleCalendarUrl({
    title,
    startDate: reminderDate,
    details,
    location: jobUrl,
  });
}