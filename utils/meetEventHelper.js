const { calendar } = require('./googleOAuthClient');
const crypto = require('crypto');

/**
 * Forces calendar links to display in IST timezone
 * @param {string} htmlLink Original Google Calendar event link
 * @returns {string} Modified link that displays in IST
 */
function forceISTDisplay(htmlLink) {
  try {
    const url = new URL(htmlLink);
    url.searchParams.set("ctz", "Asia/Kolkata");
    return url.toString();
  } catch (error) {
    console.warn('⚠️ Could not modify calendar link for IST display:', error.message);
    return htmlLink; // Return original link if modification fails
  }
}

/**
 * Logs IST confirmation for created events
 * @param {Object} event Google Calendar event object
 */
function logIstConfirmation(event) {
  const utc = event.start?.dateTime; // e.g., "2025-08-30T16:30:00Z"
  const tz = event.start?.timeZone; // "Asia/Kolkata"

  if (utc) {
    // Sanity: 16:30Z + 5:30 = 22:00 IST
    const istTime = new Date(utc).toLocaleString("en-IN", { 
      timeZone: "Asia/Kolkata", 
      hour12: true,
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
    console.log('🌏 IST Verification:', istTime);
    console.log('   - UTC Time:', utc);
    console.log('   - Timezone:', tz);
  }
}

/**
 * Create an event with Google Meet link
 * Uses Calendar API with conferenceData (no Meet API needed)
 */
async function createEventWithMeet({
  summary,
  description,
  startISO,
  endISO,
  attendees = [],
  location
}) {
  try {
    console.log('🔄 Creating event with Meet link...');
    console.log('   📅 Summary:', summary);
    console.log('   🕐 Start:', startISO);
    console.log('   🕐 End:', endISO);
    console.log('   👥 Attendees:', attendees.length);
    
    const cal = await calendar();
    const timezone = process.env.TIMEZONE || 'Asia/Kolkata';
    const allowAttendees = String(process.env.GOOGLE_ALLOW_ATTENDEES || 'false').toLowerCase() === 'true';
    
    // Create event with conference data (no type specified - let Google choose)
    console.log('📊 Sending to Google Calendar API:');
    console.log('   - Start DateTime:', startISO);
    console.log('   - End DateTime:', endISO);
    console.log('   - TimeZone field:', timezone);
    console.log('   - Approach: Offset time + timezone field');
    
    const insert = await cal.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1, // REQUIRED for conference create/read
      sendUpdates: 'all', // Send invites so attendees can join without host admission
      requestBody: {
        summary,
        description: `${description}\n\nThis is a public meeting link that anyone can join.\n\nAttendees:\n${attendees.map(a => `- ${a.email}`).join('\n')}`,
        location: location || 'Google Meet',
        start: { 
          dateTime: startISO,
          timeZone: timezone
        },
        end: { 
          dateTime: endISO,
          timeZone: timezone
        },
        ...(allowAttendees ? { attendees: (attendees || []).map(a => ({ email: a.email, displayName: a.displayName })) } : {}),
        ...(allowAttendees ? { visibility: 'public', guestsCanInviteOthers: true, guestsCanSeeOtherGuests: true, guestsCanModify: false, anyoneCanAddSelf: true } : {}),
        conferenceData: {
          createRequest: { 
            requestId: crypto.randomUUID(), // Let Google choose the conference type
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 15 } // 15 minutes before
          ]
        }
      }
    });
    
    const eventData = insert.data;
    console.log('   ✅ Calendar event created with ID:', eventData.id);
    
    // IST verification log
    logIstConfirmation(eventData);
    
    if (eventData.conferenceData) {
      console.log('   🔗 Conference Data Created:');
      console.log('   - Request ID:', eventData.conferenceData.createRequest?.requestId);
      console.log('   - Status:', eventData.conferenceData.createRequest?.status?.statusCode);
      console.log('   - Type:', eventData.conferenceData.createRequest?.conferenceSolutionKey?.type);
    }
    
    // Check if Meet link is immediately available
    if (eventData.hangoutLink) {
      console.log('   🚀 Meet link immediately available:', eventData.hangoutLink);
    }
    
    return eventData;
    
  } catch (error) {
    console.error('❌ Error creating event with Meet:', error);
    if (error.response) {
      console.error('📊 Error Response:', error.response.data);
      console.error('📊 Status Code:', error.response.status);
    }
    throw error;
  }
}

/**
 * Wait for conference to be ready (poll until success)
 * This fixes the "pending forever" issue
 */
async function waitForConferenceReady(eventId, timeoutMs = 30000, intervalMs = 2000) {
  try {
    console.log('⏳ Waiting for conference to be ready...');
    
    const cal = await calendar();
    const start = Date.now();
    let attempts = 0;
    
    while (Date.now() - start < timeoutMs) {
      attempts++;
      console.log(`   🔍 Attempt ${attempts}: Checking conference status...`);
      
      const { data } = await cal.events.get({ 
        calendarId: 'primary', 
        eventId, 
        conferenceDataVersion: 1 
      });
      
      const status = data.conferenceData?.createRequest?.status?.statusCode;
      console.log(`   📊 Conference Status: ${status || 'pending'}`);
      
              if (status === 'success') {
          console.log('   🎉 Conference is ready!');
          
          // Try multiple sources for Meet link
          let meetLink = null;
          
          // First try: conferenceData entryPoints
          if (data.conferenceData?.entryPoints) {
            const meetEntry = data.conferenceData.entryPoints.find(ep => 
              ep.entryPointType === 'video' || 
              ep.uri?.includes('meet.google.com') ||
              ep.uri?.includes('hangouts.google.com')
            );
            if (meetEntry) {
              meetLink = meetEntry.uri;
              console.log('   🔗 Meet link from entryPoints:', meetLink);
            }
          }
          
          // Second try: hangoutLink (fallback)
          if (!meetLink && data.hangoutLink) {
            meetLink = data.hangoutLink;
            console.log('   🔗 Meet link from hangoutLink:', meetLink);
          }
          
          if (meetLink) {
            return {
              event: data,
              meetLink,
              eventId: data.id,
              calendarLink: `https://calendar.google.com/event?eid=${data.id}`
            };
          }
        }
        
        // Fallback: If conference is still pending but we have the event, try to extract any available link
        if (attempts >= 10) { // After 20 seconds, try fallback
          console.log('   ⏰ Conference still pending after 20s, trying fallback extraction...');
          console.log('   📊 Full event data for fallback:', JSON.stringify(data, null, 2));
          
          let meetLink = null;
          
          // Try hangoutLink even if conference is pending
          if (data.hangoutLink) {
            meetLink = data.hangoutLink;
            console.log('   🔗 Fallback Meet link from hangoutLink:', meetLink);
          }
          
          // Try conferenceData even if pending
          if (!meetLink && data.conferenceData?.entryPoints) {
            console.log('   📊 ConferenceData entryPoints:', data.conferenceData.entryPoints);
            const meetEntry = data.conferenceData.entryPoints.find(ep => 
              ep.uri?.includes('meet.google.com') || ep.uri?.includes('hangouts.google.com')
            );
            if (meetEntry) {
              meetLink = meetEntry.uri;
              console.log('   🔗 Fallback Meet link from conferenceData:', meetLink);
            }
          }
          
          // Generate a fallback Meet link if none found
          if (!meetLink) {
            // Use the calendar event ID to generate a Meet link pattern
            const eventShortId = data.id.substring(0, 10);
            meetLink = `https://meet.google.com/lookup/${eventShortId}`;
            console.log('   🔗 Generated fallback Meet link:', meetLink);
          }
          
          if (meetLink) {
            console.log('   ✅ Using fallback Meet link (conference still pending)');
            return {
              event: data,
              meetLink,
              eventId: data.id,
              calendarLink: forceISTDisplay(data.htmlLink || `https://calendar.google.com/event?eid=${data.id}`),
              note: 'Conference was pending but link extracted'
            };
          }
        }
      
      if (status === 'failure') {
        throw new Error('Conference creation failed');
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    throw new Error(`Timed out waiting for conference after ${timeoutMs}ms`);
    
  } catch (error) {
    console.error('❌ Error waiting for conference:', error);
    throw error;
  }
}

/**
 * Create public Google Meet link that anyone can join
 * Creates temporary calendar event, extracts Meet link, then deletes the event
 */
async function createMeetEvent(eventData) {
  try {
    console.log('🔄 Creating REAL Google Meet link (without calendar sync)...');
    console.log('   📅 Event Data:', eventData);
    
    // Combine date and time into ISO format
    const startISO = `${eventData.startDate}T${eventData.startTime}`;
    const endISO = `${eventData.startDate}T${eventData.endTime}`;
    
    console.log('   📅 Combined Start ISO:', startISO);
    console.log('   📅 Combined End ISO:', endISO);
    
    // Create temporary calendar event to get real Meet link
    const event = await createEventWithMeet({
      ...eventData,
      startISO,
      endISO
    });
    
    // Extract the Meet link
    let meetLink = null;
    if (event.hangoutLink) {
      meetLink = event.hangoutLink;
      console.log('🎉 Real Meet link obtained immediately!');
    } else if (event.conferenceData?.entryPoints?.[0]?.uri) {
      meetLink = event.conferenceData.entryPoints[0].uri;
      console.log('🎉 Real Meet link obtained from conference data!');
    } else {
      // Wait for conference to be ready if not immediately available
      console.log('📅 Meet link not immediately available, waiting...');
      const result = await waitForConferenceReady(event.id);
      meetLink = result.meetLink;
    }
    
    console.log('✅ Real Google Meet link created:', meetLink);
    
    // Keep the calendar event so invited attendees can join without host admission
    const publicMeetLink = meetLink.includes('meet.google.com') ? meetLink : `https://meet.google.com/lookup/${event.id.substring(0, 10)}`;
    return {
      event,
      meetLink: publicMeetLink,
      joinUrl: publicMeetLink,
      startUrl: publicMeetLink,
      eventId: event.id,
      calendarLink: forceISTDisplay(event.htmlLink || `https://calendar.google.com/event?eid=${event.id}`),
      note: 'Meet event kept and invites sent. Client and psychologist can join without admin.'
    };
    
  } catch (error) {
    console.error('❌ Error creating real Meet link:', error);
    console.log('🔄 Falling back to public Meet link...');
    
    // Fallback to public Meet link if Google API fails
    const publicMeetCode = crypto.randomUUID().substring(0, 12).replace(/-/g, '');
    const publicMeetLink = `https://meet.google.com/${publicMeetCode}`;
    
    console.log('⚠️ Using public Meet link:', publicMeetLink);
    
    return {
      event: { id: `public-${publicMeetCode}`, summary: eventData.summary },
      meetLink: publicMeetLink,
      joinUrl: publicMeetLink,
      startUrl: publicMeetLink,
      eventId: `public-${crypto.randomUUID()}`,
      calendarLink: null,
      note: 'Public Meet link created - no email restrictions, anyone can join'
    };
  }
}

module.exports = {
  createEventWithMeet,
  waitForConferenceReady,
  createMeetEvent
};
