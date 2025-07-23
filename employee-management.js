// Employee Management Tab Functions
function addEmployee() {
  const name = document.getElementById("manage-employee-name").value.trim();
  const dailyWage = parseFloat(document.getElementById("employee-dailywage").value) || 0;
  const allowance = parseFloat(document.getElementById("employee-allowance").value) || 0;
  const otherFee = parseFloat(document.getElementById("employee-otherfee").value) || 0;

  if (!name || dailyWage < 0 || allowance < 0 || otherFee < 0) {
    alert("Vui lòng nhập đầy đủ thông tin hợp lệ!");
    return;
  }

  const newEmployee = {
    id: Date.now().toString(),
    name,
    dailyWage,
    allowance,
    otherFee,
    active: true,
    role: "employee",
    workdays: 26,
    offdays: 0,
    address: "",
    phone: "",
    note: "",
    createdAt: new Date().toISOString()
  };

  db.ref("employees/" + newEmployee.id).set(newEmployee)
    .then(() => {
      globalEmployeeData.push(newEmployee);
      alert("Thêm nhân viên thành công!");
      document.getElementById("manage-employee-name").value = "";
      document.getElementById("employee-dailywage").value = "";
      document.getElementById("employee-allowance").value = "";
      document.getElementById("employee-otherfee").value = "";
      renderEmployeeList();
    })
    .catch(err => alert("Lỗi khi thêm nhân viên: " + err.message));
}

function renderEmployeeList() {
  const container = document.getElementById("employee-list");
  if (!container) return;
  container.innerHTML = "";
  if (globalEmployeeData.length === 0) {
    container.innerHTML = "<p>Chưa có nhân viên.</p>";
    return;
  }
  globalEmployeeData.forEach(emp => {
    const div = document.createElement("div");
    div.innerHTML = `${emp.name} - Lương ngày: ${emp.dailyWage.toLocaleString('vi-VN')} VND <button onclick="deleteEmployee('${emp.id}')">Xóa</button>`;
    container.appendChild(div);
  });
}

function deleteEmployee(employeeId) {
  if (!confirm("Xóa nhân viên này?")) return;
  db.ref("employees/" + employeeId).remove()
    .then(() => {
      globalEmployeeData = globalEmployeeData.filter(emp => emp.id !== employeeId);
      renderEmployeeList();
      alert("Xóa nhân viên thành công!");
    })
    .catch(err => alert("Lỗi khi xóa nhân viên: " + err.message));
}

function renderAdvanceApprovalList() {
  const container = document.getElementById("advance-approval-list");
  if (!container) return;
  container.innerHTML = "";
  const pendingAdvances = globalAdvanceRequests.filter(a => a.status === "pending");
  if (pendingAdvances.length === 0) {
    container.innerHTML = "<p>Không có yêu cầu tạm ứng nào.</p>";
    return;
  }
  pendingAdvances.forEach(a => {
    const div = document.createElement("div");
    div.innerHTML = `${a.employeeName}: ${a.amount.toLocaleString('vi-VN')} VND - ${a.reason} <button onclick="approveAdvance('${a.id}')">Duyệt</button> <button onclick="denyAdvance('${a.id}')">Từ chối</button>`;
    container.appendChild(div);
  });
}

function approveAdvance(advanceId) {
  if (!confirm("Duyệt yêu cầu tạm ứng này?")) return;
  db.ref("advances/" + advanceId).update({ status: "approved" })
    .then(() => {
      const advance = globalAdvanceRequests.find(a => a.id === advanceId);
      if (advance) advance.status = "approved";
      renderAdvanceApprovalList();
      alert("Đã duyệt yêu cầu tạm ứng!");
    })
    .catch(err => alert("Lỗi khi duyệt yêu cầu: " + err.message));
}

function denyAdvance(advanceId) {
  if (!confirm("Từ chối yêu cầu tạm ứng này?")) return;
  db.ref("advances/" + advanceId).update({ status: "denied" })
    .then(() => {
      const advance = globalAdvanceRequests.find(a => a.id === advanceId);
      if (advance) advance.status = "denied";
      renderAdvanceApprovalList();
      alert("Đã từ chối yêu cầu tạm ứng!");
    })
    .catch(err => alert("Lỗi khi từ chối yêu cầu: " + err.message));
}

function renderScheduleApprovalList() {
  const container = document.getElementById("work-requests");
  if (!container) return;
  container.innerHTML = "";
  if (globalScheduleData.length === 0) {
    container.innerHTML = "<p>Không có yêu cầu lịch làm việc nào.</p>";
    return;
  }
  globalScheduleData.forEach(s => {
    const statusText = s.status === "off" ? "Nghỉ" : s.status === "overtime" ? "Tăng ca" : "Đổi ca";
    const approvalText = s.approvalStatus === "approved" ? "Đã duyệt" : s.approvalStatus === "denied" ? "Bị từ chối" : "Chờ duyệt";
    const div = document.createElement("div");
    div.innerHTML = `<strong>${s.employeeName}</strong>: ${statusText} - Ngày: ${s.date} - ${approvalText}
      ${approvalText === "Chờ duyệt" ? `<button onclick="approveSchedule('${s.id}')">Duyệt</button><button onclick="denySchedule('${s.id}')">Từ chối</button>` : ""}<hr>`;
    container.appendChild(div);
  });
}

// Employee Management Tab Functions (Tiếp tục)

function approveSchedule(scheduleId) {
  if (!confirm("Duyệt lịch làm việc này?")) return;
  db.ref("schedules/" + scheduleId).update({ approvalStatus: "approved" })
    .then(() => {
      const schedule = globalScheduleData.find(s => s.id === scheduleId);
      if (schedule) schedule.approvalStatus = "approved";
      renderScheduleApprovalList();
      renderScheduleStatusList();
      renderSalarySummary();
      alert("Đã duyệt lịch làm việc!");
    })
    .catch(err => alert("Lỗi khi duyệt lịch: " + err.message));
}

function denySchedule(scheduleId) {
  if (!confirm("Từ chối lịch làm việc này?")) return;
  db.ref("schedules/" + scheduleId).update({ approvalStatus: "denied" })
    .then(() => {
      const schedule = globalScheduleData.find(s => s.id === scheduleId);
      if (schedule) schedule.approvalStatus = "denied";
      renderScheduleApprovalList();
      renderScheduleStatusList();
      renderSalarySummary();
      alert("Đã từ chối lịch làm việc!");
    })
    .catch(err => alert("Lỗi khi từ chối lịch: " + err.message));
}

// Helper Functions for Data Access
function getAdvanceRequests() { return globalAdvanceRequests; }
function getScheduleData() { return globalScheduleData; }
function getEmployeeData() { return globalEmployeeData; }