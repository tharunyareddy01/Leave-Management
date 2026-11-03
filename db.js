const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "tharunya",
  database: process.env.DB_NAME || "leave_management",
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true
});

module.exports = pool;
