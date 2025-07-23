// Chat Tab Functions
function renderChat(type) {
  const container = document.getElementById(`${type}-chat`);
  if (!container) return;
  container.innerHTML = "";
  const chatMessages = globalMessages[type] || [];
  chatMessages.forEach(msg => {
    const div = document.createElement("div");
    div.innerHTML = `${msg.senderName}: ${msg.message} - ${new Date(msg.timestamp).toLocaleTimeString()}`;
    container.appendChild(div);
  });
}

function sendGroupMessage() {
  const message = document.getElementById("group-message").value.trim();
  if (!message) {
    alert("Vui lòng nhập tin nhắn!");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("Vui lòng đăng nhập để gửi tin nhắn!");
    return;
  }

  const employee = globalEmployeeData.find(e => e.id === user.uid);
  const senderName = employee ? employee.name : (user.displayName || user.email.split('@')[0] || 'Nhân viên');

  const msgData = {
    message,
    senderId: user.uid,
    senderName,
    timestamp: Date.now()
  };

  db.ref("messages/group").push(msgData)
    .then(() => {
      globalMessages.group.push(msgData);
      document.getElementById("group-message").value = "";
      renderChat("group");
    })
    .catch(err => alert("Lỗi khi gửi tin nhắn: " + err.message));
}

function sendManagerMessage() {
  const message = document.getElementById("manager-message").value.trim();
  if (!message) {
    alert("Vui lòng nhập tin nhắn!");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("Vui lòng đăng nhập để gửi tin nhắn!");
    return;
  }

  const employee = globalEmployeeData.find(e => e.id === user.uid);
  const senderName = employee ? employee.name : (user.displayName || user.email.split('@')[0] || 'Nhân viên');

  const msgData = {
    message,
    senderId: user.uid,
    senderName,
    timestamp: Date.now()
  };

  db.ref("messages/manager").push(msgData)
    .then(() => {
      globalMessages.manager.push(msgData);
      document.getElementById("manager-message").value = "";
      renderChat("manager");
    })
    .catch(err => alert("Lỗi khi gửi tin nhắn: " + err.message));
}