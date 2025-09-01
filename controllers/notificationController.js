const supabase = require('../config/supabase');
const { 
  successResponse, 
  errorResponse 
} = require('../utils/helpers');

// Get notifications for psychologist
const getNotifications = async (req, res) => {
  try {
    const psychologistId = req.user.id;
    const { page = 1, limit = 20, unread_only = false } = req.query;

    console.log('📄 Fetching notifications for psychologist:', psychologistId);

    let query = supabase
      .from('notifications')
      .select(`
        *,
        client:clients(
          first_name,
          last_name,
          child_name
        ),
        session:sessions(
          scheduled_date,
          scheduled_time,
          status
        )
      `)
      .eq('psychologist_id', psychologistId);

    // Filter for unread only if requested
    if (unread_only === 'true') {
      query = query.eq('is_read', false);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data: notifications, error, count } = await query;

    if (error) {
      console.error('Get notifications error:', error);
      return res.status(500).json(
        errorResponse('Failed to fetch notifications')
      );
    }

    // Format notifications with client names
    const formattedNotifications = notifications.map(notification => ({
      ...notification,
      client_name: notification.client?.child_name || 
                  `${notification.client?.first_name || 'Client'} ${notification.client?.last_name || ''}`.trim()
    }));

    res.json(
      successResponse({
        notifications: formattedNotifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || notifications.length,
          unread_only: unread_only === 'true'
        }
      })
    );

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching notifications')
    );
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const psychologistId = req.user.id;

    console.log('✅ Marking notification as read:', notificationId);

    // Verify notification belongs to this psychologist
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('id, psychologist_id')
      .eq('id', notificationId)
      .eq('psychologist_id', psychologistId)
      .single();

    if (fetchError || !notification) {
      return res.status(404).json(
        errorResponse('Notification not found or access denied')
      );
    }

    // Mark as read
    const { data: updatedNotification, error: updateError } = await supabase
      .from('notifications')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Mark notification as read error:', updateError);
      return res.status(500).json(
        errorResponse('Failed to mark notification as read')
      );
    }

    res.json(
      successResponse(updatedNotification, 'Notification marked as read')
    );

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json(
      errorResponse('Internal server error while marking notification as read')
    );
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const psychologistId = req.user.id;

    console.log('✅ Marking all notifications as read for psychologist:', psychologistId);

    const { data: updatedNotifications, error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('psychologist_id', psychologistId)
      .eq('is_read', false)
      .select('*');

    if (error) {
      console.error('Mark all notifications as read error:', error);
      return res.status(500).json(
        errorResponse('Failed to mark all notifications as read')
      );
    }

    res.json(
      successResponse({
        updated_count: updatedNotifications.length,
        notifications: updatedNotifications
      }, `${updatedNotifications.length} notifications marked as read`)
    );

  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json(
      errorResponse('Internal server error while marking all notifications as read')
    );
  }
};

// Get unread notification count
const getUnreadCount = async (req, res) => {
  try {
    const psychologistId = req.user.id;

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('psychologist_id', psychologistId)
      .eq('is_read', false);

    if (error) {
      console.error('Get unread count error:', error);
      return res.status(500).json(
        errorResponse('Failed to get unread notification count')
      );
    }

    res.json(
      successResponse({
        unread_count: notifications.length
      })
    );

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json(
      errorResponse('Internal server error while getting unread count')
    );
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const psychologistId = req.user.id;

    console.log('🗑️ Deleting notification:', notificationId);

    // Verify notification belongs to this psychologist and delete
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('psychologist_id', psychologistId);

    if (error) {
      console.error('Delete notification error:', error);
      return res.status(500).json(
        errorResponse('Failed to delete notification')
      );
    }

    res.json(
      successResponse(null, 'Notification deleted successfully')
    );

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json(
      errorResponse('Internal server error while deleting notification')
    );
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification
};

