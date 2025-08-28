/**
 * Calendar Invite Generator
 * Generates .ics (iCalendar) files for session bookings
 */

const crypto = require('crypto');

/**
 * Generate a calendar invite (.ics) file content
 * @param {Object} sessionData - Session details
 * @returns {string} - iCalendar file content
 */
function generateCalendarInvite(sessionData) {
  const {
    sessionId,
    clientName,
    psychologistName,
    sessionDate,
    sessionTime,
    meetLink,
    clientEmail,
    psychologistEmail,
    price,
    duration = 60 // Default 60 minutes
  } = sessionData;

  // Parse date and time
  const sessionDateTime = new Date(`${sessionDate}T${sessionTime}`);
  const endDateTime = new Date(sessionDateTime.getTime() + (duration * 60000));

  // Format dates for iCalendar (YYYYMMDDTHHMMSSZ)
  const formatICalDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const startDate = formatICalDate(sessionDateTime);
  const endDate = formatICalDate(endDateTime);
  const createdDate = formatICalDate(new Date());

  // Generate unique UID
  const uid = `session-${sessionId}-${crypto.randomUUID()}@kuttikal.com`;

  // Calendar invite content
  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kuttikal//Therapy Sessions//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${createdDate}`,
    `DTSTART:${startDate}`,
    `DTEND:${endDate}`,
    `SUMMARY:Therapy Session - ${clientName} with ${psychologistName}`,
    `DESCRIPTION:Online therapy session scheduled through Kuttikal.\\n\\n` +
    `Client: ${clientName}\\n` +
    `Psychologist: ${psychologistName}\\n` +
    `Session Fee: $${price}\\n\\n` +
    `Join the session via Google Meet:\\n${meetLink}\\n\\n` +
    `Please join the meeting 5 minutes before the scheduled time.`,
    `LOCATION:${meetLink}`,
    `ORGANIZER;CN=${psychologistName}:mailto:${psychologistEmail}`,
    `ATTENDEE;CN=${clientName};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:${clientEmail}`,
    `ATTENDEE;CN=${psychologistName};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${psychologistEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'DESCRIPTION:Therapy session reminder',
    'ACTION:DISPLAY',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'DESCRIPTION:Therapy session reminder - 1 hour',
    'ACTION:EMAIL',
    `ATTENDEE:mailto:${clientEmail}`,
    `ATTENDEE:mailto:${psychologistEmail}`,
    'SUMMARY:Therapy Session Reminder',
    'DESCRIPTION:Your therapy session starts in 1 hour.',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return icalContent;
}

/**
 * Create calendar invite for multiple recipients
 * @param {Object} sessionData - Session details
 * @returns {Object} - Calendar invites for client and psychologist
 */
function createCalendarInvites(sessionData) {
  const baseInvite = generateCalendarInvite(sessionData);
  
  return {
    client: {
      filename: `therapy-session-${sessionData.sessionId}-client.ics`,
      content: baseInvite,
      contentType: 'text/calendar; charset=utf-8'
    },
    psychologist: {
      filename: `therapy-session-${sessionData.sessionId}-psychologist.ics`,
      content: baseInvite,
      contentType: 'text/calendar; charset=utf-8'
    },
    combined: {
      filename: `therapy-session-${sessionData.sessionId}.ics`,
      content: baseInvite,
      contentType: 'text/calendar; charset=utf-8'
    }
  };
}

/**
 * Generate Google Calendar add link
 * @param {Object} sessionData - Session details
 * @returns {string} - Google Calendar add URL
 */
function generateGoogleCalendarLink(sessionData) {
  const {
    clientName,
    psychologistName,
    sessionDate,
    sessionTime,
    meetLink,
    duration = 60
  } = sessionData;

  const sessionDateTime = new Date(`${sessionDate}T${sessionTime}`);
  const endDateTime = new Date(sessionDateTime.getTime() + (duration * 60000));

  // Format for Google Calendar (YYYYMMDDTHHMMSSZ)
  const formatGoogleDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const startDate = formatGoogleDate(sessionDateTime);
  const endDate = formatGoogleDate(endDateTime);

  const title = encodeURIComponent(`Therapy Session - ${clientName} with ${psychologistName}`);
  const details = encodeURIComponent(
    `Online therapy session\n\nJoin via Google Meet: ${meetLink}\n\nPlease join 5 minutes early.`
  );
  const location = encodeURIComponent(meetLink);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}`;
}

/**
 * Generate Outlook calendar add link
 * @param {Object} sessionData - Session details
 * @returns {string} - Outlook calendar add URL
 */
function generateOutlookCalendarLink(sessionData) {
  const {
    clientName,
    psychologistName,
    sessionDate,
    sessionTime,
    meetLink,
    duration = 60
  } = sessionData;

  const sessionDateTime = new Date(`${sessionDate}T${sessionTime}`);
  const endDateTime = new Date(sessionDateTime.getTime() + (duration * 60000));

  const title = encodeURIComponent(`Therapy Session - ${clientName} with ${psychologistName}`);
  const body = encodeURIComponent(
    `Online therapy session\n\nJoin via Google Meet: ${meetLink}\n\nPlease join 5 minutes early.`
  );
  const location = encodeURIComponent(meetLink);

  const startDate = sessionDateTime.toISOString();
  const endDate = endDateTime.toISOString();

  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${body}&location=${location}&startdt=${startDate}&enddt=${endDate}`;
}

module.exports = {
  generateCalendarInvite,
  createCalendarInvites,
  generateGoogleCalendarLink,
  generateOutlookCalendarLink
};
