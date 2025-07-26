// Employee management
function approveScheduleRequest(requestId, approved) {
  return db.ref(`schedules/${requestId}`).update({
    status: approved ? 'approved' : 'rejected',
    processedAt: Date.now(),
    processedBy: currentUser.uid
  }).then(() => {
    const request = globalSchedules.find(s => s.id === requestId);
    if (!request) return;
    
    // Notify employee
    return sendNotification(request.employeeId,
      `Yêu cầu lịch làm việc của bạn đã được ${approved ? 'chấp nhận' : 'từ chối'}`,
      'schedule_approval',
      { requestId, approved }
    );
  });
}

function approveAdvanceRequest(requestId, approved) {
  return db.ref(`advances/${requestId}`).update({
    status: approved ? 'approved' : 'rejected',
    processedAt: Date.now(),
    processedBy: currentUser.uid
  }).then(() => {
    const request = globalAdvanceRequests.find(a => a.id === requestId);
    if (!request) return;
    
    // Notify employee
    return sendNotification(request.employeeId,
      `Yêu cầu tạm ứng của bạn đã được ${approved ? 'chấp nhận' : 'từ chối'}`,
      'advance_approval',
      { requestId, approved }
    );
  });
}

// Team scheduling
function createTeamSchedule(date, shifts) {
  const batchUpdates = {};
  
  shifts.forEach(shift => {
    const scheduleId = db.ref('schedules').push().key;
    batchUpdates[`schedules/${scheduleId}`] = {
      id: scheduleId,
      employeeId: shift.employeeId,
      employeeName: getEmployeeById(shift.employeeId)?.name || 'Unknown',
      date,
      type: 'shift',
      status: 'assigned',
      shift: shift.type,
      assignedBy: currentUser.uid,
      assignedAt: Date.now()
    };
    
    // Notify employee
    batchUpdates[`notifications/${shift.employeeId}/${scheduleId}`] = {
      id: scheduleId,
      message: `Bạn được phân công ca ${shift.type} vào ${date}`,
      type: 'schedule_assignment',
      timestamp: Date.now(),
      isRead: false
    };
  });
  
  return db.ref().update(batchUpdates);
}

// Group notifications
function sendGroupNotification(message) {
  const batchUpdates = {};
  const notificationId = db.ref('notifications/group').push().key;
  
  globalEmployees.forEach(employee => {
    batchUpdates[`notifications/${employee.id}/${notificationId}`] = {
      id: notificationId,
      message,
      senderId: currentUser.uid,
      senderName: 'Quản lý',
      type: 'group_notification',
      timestamp: Date.now(),
      isRead: false
    };
  });
  
  return db.ref().update(batchUpdates);
}

// Initialize manager UI
function initManagerUI() {
  renderEmployeeList();
  renderPendingRequests();
  renderTeamCalendar();
  renderGroupChat();
  renderNotificationCenter();
}