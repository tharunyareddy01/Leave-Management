CREATE DATABASE IF NOT EXISTS leave_management;
USE leave_management;

CREATE TABLE IF NOT EXISTS employees (
  employee_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  department VARCHAR(50) NOT NULL,
  designation VARCHAR(50) NOT NULL,
  role ENUM('employee','manager','admin') NOT NULL DEFAULT 'employee',\n  account_status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  manager_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_employee_manager FOREIGN KEY (manager_id)
    REFERENCES employees(employee_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS leave_types (
  leave_type_id INT AUTO_INCREMENT PRIMARY KEY,
  type_name VARCHAR(50) NOT NULL UNIQUE,
  max_days INT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS leave_requests (
  request_id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  leave_type_id INT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('Pending','Approved','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
  manager_comment TEXT NULL,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_request_employee FOREIGN KEY (employee_id)
    REFERENCES employees(employee_id) ON DELETE CASCADE,
  CONSTRAINT fk_request_type FOREIGN KEY (leave_type_id)
    REFERENCES leave_types(leave_type_id),
  CONSTRAINT fk_request_reviewer FOREIGN KEY (reviewed_by)
    REFERENCES employees(employee_id) ON DELETE SET NULL,
  CHECK (to_date >= from_date)
);

INSERT IGNORE INTO leave_types (type_name, max_days, description) VALUES
('Casual Leave', 12, 'For personal work and short breaks.'),
('Sick Leave', 10, 'For illness, recovery and medical appointments.'),
('Earned Leave', 18, 'Planned time off earned through service.'),
('Work From Home', 20, 'Request to work remotely for a day or period.');

-- Demo accounts are created by server.js on first start:
-- admin@leaveloom.demo / Admin@123
-- manager@leaveloom.demo / Manager@123
-- employee@leaveloom.demo / Employee@123
