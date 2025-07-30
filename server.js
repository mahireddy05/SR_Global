// server.js
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------- MIDDLEWARE ---------------- //
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'srglobal_secret_key',
  resave: false,
  saveUninitialized: false
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------------- DATABASE CONNECTION ---------------- //
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

connection.connect(err => {
  if (err) {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  }
  console.log('✅ MySQL Connected!');
});


// ---------------- AUTH MIDDLEWARE ---------------- //
function checkAuth(req, res, next) {
  if (req.session && req.session.adminLoggedIn) return next();
  res.redirect('/login');
}

// ---------------- ROUTES ---------------- //
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Form Submission
app.post('/submit', (req, res) => {
  const data = req.body;
  const countries = (data.countries || []).filter(Boolean).join(', ');
  const programs = (data.programs || []).filter(Boolean).join(', ');
  const level = (data.level || []).filter(Boolean).join(', ');
  const referral = (data.referral || []).filter(Boolean).join(', ');
  const visa_status = data.visa_status || '';

  const now = new Date();
  const dateTimeString = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const prefix = `SRG${dateTimeString}`;

  db.query('SELECT COUNT(*) AS count FROM students', (err, result) => {
    if (err) return res.status(500).send('Database error.');

    const serial = (result[0].count + 1).toString().padStart(5, '0');
    const submissionId = `${prefix}${serial}`;
    const submissionTime = new Date();

    const studentSql = `
      INSERT INTO students 
      (submission_id, name, dob, college, residence, email, mobile, countries, programs, level, visa_status, referral, submission_time) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const studentValues = [
      submissionId,
      data.name,
      data.dob,
      data.college,
      data.residence,
      data.email,
      data.mobile,
      countries,
      programs,
      level,
      visa_status,
      referral,
      submissionTime
    ];

    db.query(studentSql, studentValues, (err) => {
      if (err) return res.status(500).send('Insert failed.');

      const academicData = Array.isArray(data.institution) ? data.institution.map((_, i) => ([
        submissionId,
        data.institution[i] || 'N/A',
        data.major[i] || 'N/A',
        parseInt(data.ystart[i]) || 0,
        parseInt(data.ycomp[i]) || 0,
        parseFloat(data.score[i]) || 0.0,
        data.backlog[i] !== '' && data.backlog[i] != null ? parseInt(data.backlog[i]) : null
      ])) : [[
        submissionId,
        data.institution || 'N/A',
        data.major || 'N/A',
        parseInt(data.ystart) || 0,
        parseInt(data.ycomp) || 0,
        parseFloat(data.score) || 0.0,
        data.backlog !== '' && data.backlog != null ? parseInt(data.backlog) : null
      ]];

      const academicSql = `
        INSERT INTO academic_details (submission_id, institution, major, ystart, ycomp, score, backlog) 
        VALUES ?
      `;

      db.query(academicSql, [academicData], (err) => {
        if (err) return res.status(500).send('Academic insert failed.');

        res.send(`
          <h2>Form Submitted Successfully!</h2>
          <p>Your Reference ID: <code>${submissionId}</code></p>
          <a href="/">Go Back</a>
        `);
      });
    });
  });
});

// ---------------- LOGIN ROUTES ---------------- //
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const query = 'SELECT * FROM admin_users WHERE username = ? AND password = ?';

  db.query(query, [username, password], (err, results) => {
    if (err) return res.render('login', { error: 'Database error. Try again.' });

    if (results.length > 0) {
      req.session.adminLoggedIn = true;
      req.session.adminUsername = username;
      res.redirect('/admin');
    } else {
      res.render('login', { error: 'Invalid username or password' });
    }
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ---------------- ADMIN PANEL ---------------- //
app.get('/admin', checkAuth, (req, res) => {
  const username = req.session.adminUsername || 'Admin';
  db.query('SELECT * FROM students ORDER BY submission_time DESC', (err, rows) => {
    if (err) return res.status(500).send('Failed to fetch records.');
    res.render('admin', { students: rows, username });
  });
});

// ---------------- VIEW STUDENT ---------------- //
app.get('/view/:submission_id', checkAuth, (req, res) => {
  const sid = req.params.submission_id;
  const studentQuery = 'SELECT * FROM students WHERE submission_id = ?';
  const academicQuery = 'SELECT * FROM academic_details WHERE submission_id = ?';

  db.query(studentQuery, [sid], (err, studentResult) => {
    if (err || studentResult.length === 0) return res.status(500).send('Failed to fetch student.');
    const student = studentResult[0];

    db.query(academicQuery, [sid], (err, academics) => {
      if (err) return res.status(500).send('Failed to fetch academic records.');
      res.render('view', { student, academics });
    });
  });
});

// ---------------- DELETE STUDENT ---------------- //
app.get('/delete/:submission_id', checkAuth, (req, res) => {
  const sid = req.params.submission_id;
  db.query('DELETE FROM academic_details WHERE submission_id = ?', [sid], (err) => {
    if (err) return res.status(500).send('Failed to delete academic records.');
    db.query('DELETE FROM students WHERE submission_id = ?', [sid], (err) => {
      if (err) return res.status(500).send('Failed to delete student record.');
      res.redirect('/admin');
    });
  });
});

// ---------------- EDIT STUDENT ---------------- //
app.get('/edit/:submission_id', checkAuth, (req, res) => {
  const sid = req.params.submission_id;
  const studentQuery = 'SELECT * FROM students WHERE submission_id = ?';
  const academicQuery = 'SELECT * FROM academic_details WHERE submission_id = ?';

  db.query(studentQuery, [sid], (err, studentResult) => {
    if (err || studentResult.length === 0) return res.status(500).send('Failed to load edit form.');
    const student = studentResult[0];

    db.query(academicQuery, [sid], (err, academics) => {
      if (err) return res.status(500).send('Failed to load academic data.');
      res.render('edit', { student, academics });
    });
  });
});

app.post('/edit/:submission_id', checkAuth, (req, res) => {
  const sid = req.params.submission_id;
  const data = req.body;

  const countries = (data.countries || []).filter(Boolean).join(', ');
  const programs = (data.programs || []).filter(Boolean).join(', ');
  const level = (data.level || []).filter(Boolean).join(', ');
  const referral = (data.referral || []).filter(Boolean).join(', ');
  const visa_status = data.visa_status || '';

  const updateStudentSql = `
    UPDATE students SET name=?, dob=?, college=?, residence=?, email=?, mobile=?, 
      countries=?, programs=?, level=?, visa_status=?, referral=? 
    WHERE submission_id=?
  `;

  const studentValues = [
    data.name,
    data.dob,
    data.college,
    data.residence,
    data.email,
    data.mobile,
    countries,
    programs,
    level,
    visa_status,
    referral,
    sid
  ];

  db.query(updateStudentSql, studentValues, (err) => {
    if (err) return res.status(500).send('Update failed.');

    db.query('DELETE FROM academic_details WHERE submission_id = ?', [sid], (err) => {
      if (err) return res.status(500).send('Failed to delete old academics.');

      const academicData = JSON.parse(data.academic_json || '[]').map(row => ([
        sid,
        row.institution || 'N/A',
        row.major || 'N/A',
        parseInt(row.ystart) || 0,
        parseInt(row.ycomp) || 0,
        parseFloat(row.score) || 0.0,
        row.backlog !== '' && row.backlog != null ? parseInt(row.backlog) : null
      ]));

      if (academicData.length === 0) return res.redirect('/admin');

      const academicSql = `
        INSERT INTO academic_details (submission_id, institution, major, ystart, ycomp, score, backlog)
        VALUES ?
      `;

      db.query(academicSql, [academicData], (err) => {
        if (err) return res.status(500).send('Failed to insert updated academics.');
        res.redirect('/admin');
      });
    });
  });
});

// ---------------- START SERVER ---------------- //
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
