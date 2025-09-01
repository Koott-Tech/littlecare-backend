const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  async initializeTransporter() {
    try {
      // Configure email transporter (you can use Gmail, SendGrid, etc.)
      this.transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      // Verify connection
      await this.transporter.verify();
      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Email service initialization failed:', error);
      // Continue without email service
    }
  }

  async sendSessionConfirmation(sessionData) {
    try {
      const {
        clientName,
        psychologistName,
        clientEmail,
        psychologistEmail,
        scheduledDate,
        scheduledTime,
        googleMeetLink,
        sessionId,
        sessionDate,
        sessionTime,
        meetLink,
        price
      } = sessionData;

      // Use consistent date/time format
      const finalSessionDate = sessionDate || scheduledDate;
      const finalSessionTime = sessionTime || scheduledTime;
      const finalMeetLink = meetLink || googleMeetLink;
      
      // Parse date and time in IST (UTC+5:30)
      const sessionDateTime = new Date(`${finalSessionDate}T${finalSessionTime}+05:30`);
      const formattedDate = sessionDateTime.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Kolkata'
      });
      const formattedTime = sessionDateTime.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
        timeZoneName: 'short'
      });

      console.log('📅 Email formatting (IST):');
      console.log('   - Original time:', `${finalSessionDate}T${finalSessionTime}`);
      console.log('   - Session DateTime:', sessionDateTime.toISOString());
      console.log('   - Session DateTime (local):', sessionDateTime.toString());
      console.log('   - Session DateTime (IST):', sessionDateTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
      console.log('   - Formatted Date:', formattedDate);
      console.log('   - Formatted Time:', formattedTime);

      // Generate calendar invites
      const { createCalendarInvites, generateGoogleCalendarLink, generateOutlookCalendarLink } = require('./calendarInviteGenerator');
      
      const calendarData = {
        sessionId: sessionId || 'unknown',
        clientName,
        psychologistName,
        sessionDate: finalSessionDate,
        sessionTime: finalSessionTime,
        meetLink: finalMeetLink,
        clientEmail,
        psychologistEmail,
        price: price || 0
      };

      const calendarInvites = createCalendarInvites(calendarData);
      const googleCalendarLink = generateGoogleCalendarLink(calendarData);
      const outlookCalendarLink = generateOutlookCalendarLink(calendarData);

      // Send email to client
      if (clientEmail && !clientEmail.includes('placeholder')) {
        console.log('📧 Sending email to client:', clientEmail);
        await this.sendClientConfirmation({
          to: clientEmail,
          clientName,
          psychologistName,
          scheduledDate: formattedDate,
          scheduledTime: formattedTime,
          googleMeetLink: finalMeetLink,
          sessionId,
          calendarInvite: calendarInvites.client,
          googleCalendarLink,
          outlookCalendarLink,
          price
        });
      } else {
        console.log('⚠️ Skipping client email (placeholder or missing):', clientEmail);
      }

      // Send email to psychologist
      if (psychologistEmail && !psychologistEmail.includes('placeholder')) {
        console.log('📧 Sending email to psychologist:', psychologistEmail);
        await this.sendPsychologistConfirmation({
          to: psychologistEmail,
          clientName,
          psychologistName,
          scheduledDate: formattedDate,
          scheduledTime: formattedTime,
          googleMeetLink: finalMeetLink,
          sessionId,
          calendarInvite: calendarInvites.psychologist,
          googleCalendarLink,
          outlookCalendarLink,
          price
        });
      } else {
        console.log('⚠️ Skipping psychologist email (placeholder or missing):', psychologistEmail);
      }

      // Send email to company admin
      const adminEmail = process.env.COMPANY_ADMIN_EMAIL;
      if (adminEmail) {
        await this.sendAdminNotification({
          to: adminEmail,
          clientName,
          psychologistName,
          scheduledDate: formattedDate,
          scheduledTime: formattedTime,
          sessionId
        });
      }

      return true;
    } catch (error) {
      console.error('Error sending session confirmation emails:', error);
      return false;
    }
  }

  async sendClientConfirmation(emailData) {
    const { 
      to, 
      clientName, 
      psychologistName, 
      scheduledDate, 
      scheduledTime, 
      googleMeetLink, 
      sessionId,
      calendarInvite,
      googleCalendarLink,
      outlookCalendarLink,
      price
    } = emailData;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@kuttikal.com',
      to: to,
      subject: `Session Confirmed - ${scheduledDate} at ${scheduledTime}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Session Confirmed!</h1>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <h2 style="color: #333;">Hello ${clientName},</h2>
            
            <p>Your therapy session has been successfully scheduled. Here are the details:</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="color: #667eea; margin-top: 0;">Session Details</h3>
              <p><strong>Date:</strong> ${scheduledDate}</p>
              <p><strong>Time:</strong> ${scheduledTime}</p>
              <p><strong>Therapist:</strong> ${psychologistName}</p>
              <p><strong>Session Fee:</strong> $${price || 'TBD'}</p>
              <p><strong>Session ID:</strong> ${sessionId}</p>
            </div>
            
            ${googleCalendarLink || outlookCalendarLink ? `
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin-top: 0;">📅 Add to Your Calendar</h3>
              <p>Don't forget your appointment! Add it to your calendar:</p>
              <div style="margin: 15px 0;">
                ${googleCalendarLink ? `
                <a href="${googleCalendarLink}" target="_blank" style="display: inline-block; background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin: 5px; font-weight: bold;">
                  📅 Add to Google Calendar
                </a>
                ` : ''}
                ${outlookCalendarLink ? `
                <a href="${outlookCalendarLink}" target="_blank" style="display: inline-block; background: #0078d4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin: 5px; font-weight: bold;">
                  📅 Add to Outlook
                </a>
                ` : ''}
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 15px;">
                💡 <strong>Tip:</strong> Adding this to your calendar will help you remember your appointment and receive automatic reminders.
              </p>
            </div>
            ` : ''}
            
            ${googleMeetLink ? `
            <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h3 style="color: #28a745; margin-top: 0;">Join Your Session</h3>
              <p>Click the button below to join your Google Meet session:</p>
              <a href="${googleMeetLink}" style="display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Join Google Meet
              </a>
              <p style="margin-top: 10px; font-size: 14px; color: #666;">
                Or copy this link: <a href="${googleMeetLink}">${googleMeetLink}</a>
              </p>
            </div>
            ` : ''}
            
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin-top: 0;">Important Reminders</h3>
              <ul style="color: #856404;">
                <li>Please join the session 5 minutes before the scheduled time</li>
                <li>Ensure you have a stable internet connection</li>
                <li>Find a quiet, private space for your session</li>
                <li>Have any relevant documents or notes ready</li>
              </ul>
            </div>
            
            <p>If you need to reschedule or have any questions, please contact us at support@kuttikal.com</p>
            
            <p>We look forward to supporting you on your wellness journey!</p>
            
            <p>Best regards,<br>The Kuttikal Team</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 14px;">
              This email was sent to confirm your therapy session. 
              If you have any questions, please contact support@kuttikal.com
            </p>
          </div>
        </div>
      `,
      attachments: calendarInvite ? [
        {
          filename: calendarInvite.filename,
          content: calendarInvite.content,
          contentType: calendarInvite.contentType
        }
      ] : []
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendPsychologistConfirmation(emailData) {
    const { 
      to, 
      clientName, 
      psychologistName, 
      scheduledDate, 
      scheduledTime, 
      googleMeetLink, 
      sessionId,
      calendarInvite,
      googleCalendarLink,
      outlookCalendarLink,
      price
    } = emailData;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@kuttikal.com',
      to: to,
      subject: `New Session Scheduled - ${scheduledDate} at ${scheduledTime}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">New Session Scheduled</h1>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <h2 style="color: #333;">Hello ${psychologistName},</h2>
            
            <p>A new therapy session has been scheduled with you. Here are the details:</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h3 style="color: #28a745; margin-top: 0;">Session Details</h3>
              <p><strong>Date:</strong> ${scheduledDate}</p>
              <p><strong>Time:</strong> ${scheduledTime}</p>
              <p><strong>Client:</strong> ${clientName}</p>
              <p><strong>Session Fee:</strong> $${price || 'TBD'}</p>
              <p><strong>Session ID:</strong> ${sessionId}</p>
            </div>
            
            ${googleCalendarLink || outlookCalendarLink ? `
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin-top: 0;">📅 Add to Your Calendar</h3>
              <p>Add this session to your calendar:</p>
              <div style="margin: 15px 0;">
                ${googleCalendarLink ? `
                <a href="${googleCalendarLink}" target="_blank" style="display: inline-block; background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin: 5px; font-weight: bold;">
                  📅 Add to Google Calendar
                </a>
                ` : ''}
                ${outlookCalendarLink ? `
                <a href="${outlookCalendarLink}" target="_blank" style="display: inline-block; background: #0078d4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin: 5px; font-weight: bold;">
                  📅 Add to Outlook
                </a>
                ` : ''}
              </div>
            </div>
            ` : ''}
            
            ${googleMeetLink ? `
            <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h3 style="color: #28a745; margin-top: 0;">Session Link</h3>
              <p>Your Google Meet session is ready:</p>
              <a href="${googleMeetLink}" style="display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Start Session
              </a>
              <p style="margin-top: 10px; font-size: 14px; color: #666;">
                Or copy this link: <a href="${googleMeetLink}">${googleMeetLink}</a>
              </p>
            </div>
            ` : ''}
            
            <div style="background: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #17a2b8;">
              <h3 style="color: #0c5460; margin-top: 0;">Session Preparation</h3>
              <ul style="color: #0c5460;">
                <li>Review client information and previous session notes</li>
                <li>Prepare any relevant materials or resources</li>
                <li>Ensure your workspace is professional and private</li>
                <li>Test your audio and video equipment</li>
              </ul>
            </div>
            
            <p>Please ensure you're available 5 minutes before the scheduled time to start the session.</p>
            
            <p>If you need to reschedule or have any questions, please contact the admin team.</p>
            
            <p>Best regards,<br>The Kuttikal Team</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 14px;">
              This email confirms your scheduled therapy session. 
              Please ensure you're prepared and than on time.
            </p>
          </div>
        </div>
      `,
      attachments: calendarInvite ? [
        {
          filename: calendarInvite.filename,
          content: calendarInvite.content,
          contentType: calendarInvite.contentType
        }
      ] : []
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendAdminNotification(emailData) {
    const { to, clientName, psychologistName, scheduledDate, scheduledTime, sessionId } = emailData;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@kuttikal.com',
      to: to,
      subject: `New Session Booked - ${scheduledDate} at ${scheduledTime}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">New Session Booked</h1>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <h2 style="color: #333;">Admin Notification</h2>
            
            <p>A new therapy session has been booked on the platform. Here are the details:</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6f42c1;">
              <h3 style="color: #6f42c1; margin-top: 0;">Session Details</h3>
              <p><strong>Date:</strong> ${scheduledDate}</p>
              <p><strong>Time:</strong> ${scheduledTime}</p>
              <p><strong>Client:</strong> ${clientName}</p>
              <p><strong>Therapist:</strong> ${psychologistName}</p>
              <p><strong>Session ID:</strong> ${sessionId}</p>
            </div>
            
            <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
              <h3 style="color: #721c24; margin-top: 0;">Action Required</h3>
              <ul style="color: #721c24;">
                <li>Verify session details in the admin panel</li>
                <li>Ensure therapist availability is confirmed</li>
                <li>Check if any special accommodations are needed</li>
                <li>Monitor session completion and follow-up</li>
              </ul>
            </div>
            
            <p>This session has been automatically added to the Google Calendar and all parties have been notified.</p>
            
            <p>Best regards,<br>Kuttikal Platform</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 14px;">
              This is an automated notification from the Kuttikal therapy platform.
            </p>
          </div>
        </div>
      `
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendRescheduleNotification(sessionData, oldDate, oldTime) {
    try {
      const {
        clientName,
        psychologistName,
        clientEmail,
        psychologistEmail,
        scheduledDate,
        scheduledTime,
        sessionId
      } = sessionData;

      const oldDateTime = new Date(`${oldDate}T${oldTime}`);
      const newDateTime = new Date(`${scheduledDate}T${scheduledTime}`);

      const formattedOldDate = oldDateTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const formattedOldTime = oldDateTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      const formattedNewDate = newDateTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const formattedNewTime = newDateTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      // Send reschedule notifications
      if (clientEmail) {
        await this.sendRescheduleEmail({
          to: clientEmail,
          name: clientName,
          oldDate: formattedOldDate,
          oldTime: formattedOldTime,
          newDate: formattedNewDate,
          newTime: formattedNewTime,
          sessionId,
          type: 'client'
        });
      }

      if (psychologistEmail) {
        await this.sendRescheduleEmail({
          to: psychologistEmail,
          name: psychologistName,
          oldDate: formattedOldDate,
          oldTime: formattedOldTime,
          newDate: formattedNewDate,
          newTime: formattedNewTime,
          sessionId,
          type: 'psychologist'
        });
      }

      return true;
    } catch (error) {
      console.error('Error sending reschedule notifications:', error);
      return false;
    }
  }

  async sendRescheduleEmail(emailData) {
    const { to, name, oldDate, oldTime, newDate, newTime, sessionId, type } = emailData;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@kuttikal.com',
      to: to,
      subject: `Session Rescheduled - ${newDate} at ${newTime}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #fd7e14 0%, #ffc107 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Session Rescheduled</h1>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <h2 style="color: #333;">Hello ${name},</h2>
            
            <p>Your therapy session has been rescheduled. Here are the updated details:</p>
            
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin-top: 0;">Previous Schedule</h3>
              <p><strong>Date:</strong> ${oldDate}</p>
              <p><strong>Time:</strong> ${oldTime}</p>
            </div>
            
            <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h3 style="color: #155724; margin-top: 0;">New Schedule</h3>
              <p><strong>Date:</strong> ${newDate}</p>
              <p><strong>Time:</strong> ${newTime}</p>
            </div>
            
            <div style="background: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #17a2b8;">
              <h3 style="color: #0c5460; margin-top: 0;">Session Information</h3>
              <p><strong>Session ID:</strong> ${sessionId}</p>
              <p><strong>Type:</strong> ${type === 'client' ? 'Client' : 'Therapist'}</p>
            </div>
            
            <p>Please update your calendar and ensure you're available at the new time.</p>
            
            <p>If you have any questions or need to make further changes, please contact us.</p>
            
            <p>Best regards,<br>The Kuttikal Team</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 14px;">
              This email confirms your session has been rescheduled. 
              Please note the new date and time.
            </p>
          </div>
        </div>
      `
    };

    return this.transporter.sendMail(mailOptions);
  }
}

module.exports = new EmailService();
