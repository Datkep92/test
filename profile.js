// Calendar functions
function renderCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;
  
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  const schedules = getEmployeeSchedules(currentUser.uid);
  
  // Render calendar UI
  // (Implement your calendar rendering logic here)
}

// Schedule request
function requestScheduleChange(date, type, extraData = {}) {
  const requestId = db.ref('schedules').push().key;
  const request = {
    id: requestId,
    employeeId: currentUser.uid,
    employeeName: currentUser.displayName,
    date,
    type,
    status: 'pending',
    ...extraData,
    createdAt: Date.now()
  };
  
  return db.ref(`schedules/${requestId}`).set(request)
    .then(() => {
      // Notify manager
      return sendNotification('manager', 
        `Yêu cầu ${type} từ ${currentUser.displayName} vào ${date}`,
        'schedule_request',
        { requestId }
      );
    });
}

// Advance request
function requestAdvance(amount, reason) {
  const requestId = db.ref('advances').push().key;
  const request = {
    id: requestId,
    employeeId: currentUser.uid,
    employeeName: currentUser.displayName,
    amount,
    reason,
    status: 'pending',
    createdAt: Date.now()
  };
  
  return db.ref(`advances/${requestId}`).set(request)
    .then(() => {
      // Notify manager
      return sendNotification('manager',
        `Yêu cầu tạm ứng ${amount} từ ${currentUser.displayName}`,
        'advance_request',
        { requestId }
      );
    });
}

// Chat functions
function sendChatMessage(receiverId, message) {
  const chatId = receiverId === 'group' ? 'group' : [currentUser.uid, receiverId].sort().join('_');
  const messageId = db.ref(`messages/${chatId}`).push().key;
  
  const chatMessage = {
    id: messageId,
    senderId: currentUser.uid,
    senderName: currentUser.displayName,
    message,
    timestamp: Date.now()
  };
  
  return db.ref(`messages/${chatId}/${messageId}`).set(chatMessage)
    .then(() => {
      // Send notification if not group chat
      if (receiverId !== 'group') {
        return sendNotification(receiverId,
          `Tin nhắn mới từ ${currentUser.displayName}`,
          'chat_message',
          { chatId }
        );
      }
    });
}

// Notification handling
function handleNotification(notification) {
  switch(notification.type) {
    case 'schedule_approval':
      // Handle schedule approval/denial
      break;
    case 'advance_approval':
      // Handle advance approval/denial
      break;
    case 'chat_message':
      // Handle new chat message
      break;
    default:
      // Show generic notification
  }
  
  // Mark as read
  markAsRead(notification.id);
}

// Initialize employee UI
function initEmployeeUI() {
  renderCalendar();
  renderNotifications();
  renderChat();
  renderScheduleStatus();
  renderAdvanceHistory();
}