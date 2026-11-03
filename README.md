# LeaveLoom — Employee Leave Management System

A full-stack employee leave management project built with **HTML, CSS, JavaScript, Node.js, Express and MySQL**.

## Features
- Employee self-service signup with email/password credentials\n- Admin approval or rejection of newly registered employee accounts\n- Employee, manager and admin demo sign-in
- Employee leave application with date validation
- Leave request history and status tracking
- Manager approval / rejection with an optional comment
- Employee directory for managers and admins
- Dashboard counts and recent requests
- MySQL relational tables with primary and foreign keys
- Responsive, custom-designed interface

## Requirements
- Node.js 18+
- MySQL Server 8+
- VS Code (recommended)

## Setup (Windows)
1. Extract the ZIP and open the `leave_management_system` folder in VS Code.
2. Open MySQL Workbench or MySQL Command Line Client.
3. Run the complete `database.sql` file. It creates the `leave_management` database and its tables.
4. In VS Code terminal, install dependencies:
   ```bash
   npm install
   ```
5. Copy `.env.example` and rename the copy to `.env`.
6. Open `.env` and enter your MySQL password:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_actual_mysql_password
   DB_NAME=leave_management
   PORT=3000
   SESSION_SECRET=use_a_long_random_value
   ```
7. Start the server:
   ```bash
   npm start
   ```
8. Open `http://localhost:3000` in your browser.

## Demo accounts
| Role | Email | Password |
|---|---|---|
| Employee | employee@leaveloom.demo | Employee@123 |
| Manager | manager@leaveloom.demo | Manager@123 |
| Admin | admin@leaveloom.demo | Admin@123 |

Demo accounts are inserted automatically on first server start. The passwords are for local demonstration only. Change them before any real deployment.

## Create a new employee account
1. On the sign-in page, click **Create an account**.
2. Enter your name, work email, department, designation and password.
3. Submit the form. The account is saved in MySQL with **Pending** status.
4. Sign in using the demo admin account (`admin@leaveloom.demo` / `Admin@123`).
5. Open **People directory**. In **Signup approvals**, click **Approve** or **Reject**.
6. After approval, the employee can sign in using the email and password they registered with.

New signups are employee accounts only. Existing installations are automatically migrated on server startup to add the account approval status column; existing accounts remain approved.

## Database design
- `employees`: employee details, login hash, role and optional manager relationship
- `leave_types`: leave category, maximum days and description
- `leave_requests`: employee, leave type, date range, reason, status and reviewer details

## Notes
This is a college-project starter, not a production HR platform. For production, add HTTPS, a persistent session store, CSRF protection, rate limiting, password reset, audit logs, stricter authorization rules and configurable leave-balance calculations.
