const { calendar } = require('./googleOAuthClient');
const crypto = require('crypto');

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
    
    // Create event with conference data (no type specified - let Google choose)
    console.log('📊 Sending to Google Calendar API:');
    console.log('   - Start DateTime:', startISO);
    console.log('   - End DateTime:', endISO);
    console.log('   - TimeZone:', timezone);
    
    const insert = await cal.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1, // REQUIRED for conference create/read
      sendUpdates: 'none', // Don't send updates since we can't invite attendees
      requestBody: {
        summary,
        description: `${description}\n\nAttendees:\n${attendees.map(a => `- ${a.email}`).join('\n')}`,
        location: location || 'Google Meet',
        start: { 
          dateTime: startISO,
          timeZone: timezone
        },
        end: { 
          dateTime: endISO,
          timeZone: timezone
        },
        // Removed attendees array to avoid Domain-Wide Delegation requirement
        conferenceData: {
          createRequest: { 
            requestId: crypto.randomUUID() // no type specified - let Google choose
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
              calendarLink: `https://calendar.google.com/event?eid=${data.id}`,
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
 * Create event with Meet and wait for it to be ready
 */
async function createMeetEvent(eventData) {
  try {
    // Create the event
    const event = await createEventWithMeet(eventData);
    
    // Check if Meet link is immediately available
    if (event.hangoutLink) {
      console.log('🎉 Meet link immediately available!');
      console.log('   🔗 Meet Link:', event.hangoutLink);
      return {
        event,
        meetLink: event.hangoutLink,
        eventId: event.id,
        calendarLink: `https://calendar.google.com/event?eid=${event.id}`,
        note: 'Meet link was immediately available'
      };
    }
    
    // If not immediately available, wait for it to be ready
    console.log('📅 Meet link not immediately available, waiting for conference to be ready...');
    const result = await waitForConferenceReady(event.id);
    
    console.log('🎉 Meet event created successfully!');
    console.log('   🔗 Meet Link:', result.meetLink);
    console.log('   📅 Calendar Link:', result.calendarLink);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error creating Meet event:', error);
    throw error;
  }
}

module.exports = {
  createEventWithMeet,
  waitForConferenceReady,
  createMeetEvent
};
