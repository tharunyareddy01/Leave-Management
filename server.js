require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const db = require("./db");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-demo-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: "Please sign in." });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}
function requireManager(req, res, next) {
  if (!req.session.user || !["manager", "admin"].includes(req.session.user.role)) {
    return res.status(403).json({ message: "Manager access required." });
  }
  next();
}
const safeUser = u => ({
  employee_id: u.employee_id, name: u.name, email: u.email,
  department: u.department, designation: u.designation, role: u.role
});

async function seedDemoUsers() {
  const users = [
    ["Avery Morgan", "admin@leaveloom.demo", "Admin@123", "People & Culture", "System Administrator", "admin"],
    ["Jordan Lee", "manager@leaveloom.demo", "Manager@123", "Design", "Team Manager", "manager"],
    ["Taylor Reed", "employee@leaveloom.demo", "Employee@123", "Design", "Product Designer", "employee"]
  ];
  for (const [name,email,password,department,designation,role] of users) {
    const [rows] = await db.query("SELECT employee_id FROM employees WHERE email=?", [email]);
    if (!rows.length) {
      const hash = await bcrypt.hash(password, 10);
      await db.query(
        "INSERT INTO employees (name,email,password_hash,department,designation,role,account_status) VALUES (?,?,?,?,?,?, 'Approved')",
        [name,email,hash,department,designation,role]
      );
    }
  }
}

async function ensureAccountApprovalColumn() {
  const [columns] = await db.query("SHOW COLUMNS FROM employees LIKE 'account_status'");
  if (!columns.length) {
    // Existing installations keep their current accounts working; only new signups need approval.
    await db.query("ALTER TABLE employees ADD COLUMN account_status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Approved' AFTER role");
  }
}

app.post("/api/signup", async (req,res) => {
  try {
    const { name, email, department, designation, password, confirmPassword } = req.body;
    if (![name,email,department,designation,password,confirmPassword].every(v => String(v || "").trim())) {
      return res.status(400).json({ message: "Please complete all fields." });
    }
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match." });
    const [existing] = await db.query("SELECT employee_id FROM employees WHERE email=?", [email.trim().toLowerCase()]);
    if (existing.length) return res.status(409).json({ message: "An account with this email already exists." });
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO employees (name,email,password_hash,department,designation,role,account_status) VALUES (?,?,?,?,?,'employee','Pending')",
      [name.trim(), email.trim().toLowerCase(), hash, department.trim(), designation.trim()]
    );
    res.status(201).json({ message: "Account created! Your account is waiting for admin approval. You can sign in after it is approved." });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "An account with this email already exists." });
    res.status(500).json({ message: "Unable to create your account. Please try again." });
  }
});

app.post("/api/login", async (req,res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query("SELECT * FROM employees WHERE email=?", [email]);
    if (!rows.length || !(await bcrypt.compare(password || "", rows[0].password_hash))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }
    if (rows[0].account_status === "Pending") return res.status(403).json({ message: "Your account is waiting for admin approval." });
    if (rows[0].account_status === "Rejected") return res.status(403).json({ message: "Your account request was not approved. Please contact the administrator." });
    req.session.user = safeUser(rows[0]);
    res.json({ user: req.session.user });
  } catch (e) { res.status(500).json({ message: "Unable to sign in." }); }
});
app.post("/api/logout", (req,res) => req.session.destroy(() => res.json({ ok: true })));
app.get("/api/me", (req,res) => res.json({ user: req.session.user || null }));

app.get("/api/dashboard", requireAuth, async (req,res) => {
  try {
    const u = req.session.user;
    const where = u.role === "employee" ? "WHERE employee_id=?" : "";
    const params = u.role === "employee" ? [u.employee_id] : [];
    const [[{ totalEmployees }]] = await db.query(`SELECT COUNT(*) totalEmployees FROM employees ${where}`, params);
    const requestWhere = u.role === "employee" ? "WHERE employee_id=?" : "";
    const [counts] = await db.query(
      `SELECT status, COUNT(*) total FROM leave_requests ${requestWhere} GROUP BY status`,
      params
    );
    const [recent] = await db.query(
      `SELECT lr.request_id, lr.from_date, lr.to_date, lr.reason, lr.status, lr.created_at,
        e.name employee_name, e.department, lt.type_name
       FROM leave_requests lr JOIN employees e ON e.employee_id=lr.employee_id
       JOIN leave_types lt ON lt.leave_type_id=lr.leave_type_id
       ${u.role === "employee" ? "WHERE lr.employee_id=?" : ""}
       ORDER BY lr.created_at DESC LIMIT 6`, params
    );
    const [pendingRows] = await db.query(
      `SELECT COUNT(*) total FROM leave_requests ${u.role === "employee" ? "WHERE employee_id=? AND status='Pending'" : "WHERE status='Pending'"}`,
      params
    );
    res.json({ totalEmployees, counts, recent, pending: pendingRows[0].total });
  } catch (e) { res.status(500).json({ message: "Dashboard could not be loaded." }); }
});

app.get("/api/leave-types", requireAuth, async (req,res) => {
  const [rows] = await db.query("SELECT * FROM leave_types ORDER BY type_name");
  res.json(rows);
});

app.post("/api/requests", requireAuth, async (req,res) => {
  try {
    const { leave_type_id, from_date, to_date, reason } = req.body;
    if (!leave_type_id || !from_date || !to_date || !reason?.trim()) {
      return res.status(400).json({ message: "Complete all fields before submitting." });
    }
    if (to_date < from_date) return res.status(400).json({ message: "End date must be after start date." });
    const [overlap] = await db.query(
      `SELECT request_id FROM leave_requests WHERE employee_id=? AND status IN ('Pending','Approved')
       AND NOT (to_date < ? OR from_date > ?)`,
      [req.session.user.employee_id, from_date, to_date]
    );
    if (overlap.length) return res.status(409).json({ message: "You already have a pending or approved request for these dates." });
    await db.query(
      "INSERT INTO leave_requests (employee_id,leave_type_id,from_date,to_date,reason) VALUES (?,?,?,?,?)",
      [req.session.user.employee_id, leave_type_id, from_date, to_date, reason.trim()]
    );
    res.status(201).json({ message: "Your leave request has been submitted." });
  } catch (e) { res.status(500).json({ message: "Could not submit request." }); }
});

app.get("/api/requests", requireAuth, async (req,res) => {
  const u = req.session.user;
  const own = u.role === "employee" ? "WHERE lr.employee_id=?" : "";
  const [rows] = await db.query(
    `SELECT lr.*, e.name employee_name, e.email, e.department, lt.type_name,
      reviewer.name reviewer_name
     FROM leave_requests lr JOIN employees e ON e.employee_id=lr.employee_id
     JOIN leave_types lt ON lt.leave_type_id=lr.leave_type_id
     LEFT JOIN employees reviewer ON reviewer.employee_id=lr.reviewed_by
     ${own} ORDER BY lr.created_at DESC`,
    u.role === "employee" ? [u.employee_id] : []
  );
  res.json(rows);
});

app.patch("/api/requests/:id/status", requireManager, async (req,res) => {
  const { status, manager_comment } = req.body;
  if (!["Approved","Rejected"].includes(status)) return res.status(400).json({ message: "Invalid decision." });
  const [result] = await db.query(
    `UPDATE leave_requests SET status=?, manager_comment=?, reviewed_by=?, reviewed_at=NOW()
     WHERE request_id=? AND status='Pending'`,
    [status, manager_comment || null, req.session.user.employee_id, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: "Pending request not found." });
  res.json({ message: `Request ${status.toLowerCase()}.` });
});

app.delete("/api/requests/:id", requireAuth, async (req,res) => {
  const [result] = await db.query(
    "DELETE FROM leave_requests WHERE request_id=? AND employee_id=? AND status='Pending'",
    [req.params.id, req.session.user.employee_id]
  );
  if (!result.affectedRows) return res.status(400).json({ message: "Only your pending requests can be withdrawn." });
  res.json({ message: "Request withdrawn." });
});

app.get("/api/pending-accounts", requireAdmin, async (req,res) => {
  const [rows] = await db.query(
    "SELECT employee_id,name,email,department,designation,created_at FROM employees WHERE account_status='Pending' ORDER BY created_at ASC"
  );
  res.json(rows);
});

app.patch("/api/accounts/:id/status", requireAdmin, async (req,res) => {
  const { status } = req.body;
  if (!["Approved","Rejected"].includes(status)) return res.status(400).json({ message: "Invalid account decision." });
  const [result] = await db.query(
    "UPDATE employees SET account_status=? WHERE employee_id=? AND account_status='Pending'",
    [status, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: "Pending account not found." });
  res.json({ message: `Account ${status.toLowerCase()}.` });
});

app.get("/api/employees", requireManager, async (req,res) => {
  const [rows] = await db.query(
    "SELECT employee_id,name,email,department,designation,role FROM employees ORDER BY name"
  );
  res.json(rows);
});

app.get("*", (req,res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const port = process.env.PORT || 3000;
(async () => {
  try {
    await db.query("SELECT 1");
    await ensureAccountApprovalColumn();
    await seedDemoUsers();
    app.listen(port, () => console.log(`LeaveLoom running at http://localhost:${port}`));
  } catch (err) {
    console.error("Database connection failed. Check MySQL and your .env settings.", err.message);
    process.exit(1);
  }
})();
