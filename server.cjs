const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const twilio = require('twilio'); // ✅ THIS LINE IS MISSING
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { google } = require('googleapis');
const fs = require('fs');

require('dotenv').config();



const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());


// const db = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',
//   password: '1234', // Your MySQL password
//   database: 'otp_demo',
// });

// const db = mysql.createPool({
//   host: "sql12.freesqldatabase.com",
//   user: "sql12786047",
//   password: "G2c79E9hh8", // Your MySQL password
//   database: "sql12786047",
//   port: 3306,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });

const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Connected to MySQL');
    connection.release();
  }
});

// db.connect((err) => {
//   if (err) {
//     console.error('❌ Database connection error:', err);
//   } else {
//     console.log('✅ Connected to MySQL');
//   }
// });
//send otp


// const accountSid = 'ACb7d1489c18ec07b92a5b9b66ba8c374d';//AC2386df8e3b1afeae7dad935f23b51ab0
// const authToken = '9d93622fc3fcd009999d433fe19f7776';//76b1d1984df91680aa99a778653fc462
// const twilioNumber = '+16085935230';//+12178035187

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_TOKEN;
const twilioNumber = process.env.TWILIO_NUMBER;

const client = twilio(accountSid, authToken);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Temporary in-memory store (for demo only)
const otpStore = {};                  // { "mobileNumber": "1234" }
const registeredMobiles = new Set(); // [ "9876543210" ]




// Route 2: Send 4-digit OTP
app.post('/send-otp', async (req, res) => {
  const { mobileNumber } = req.body;

  if (!mobileNumber) {
    return res.status(400).json({ success: false, message: 'Mobile number required' });
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP
  console.log(`Generated OTP for ${mobileNumber}: ${otp}`);

  try {
    await client.messages.create({
      body: `Your OTP is: ${otp}`,
      from: twilioNumber,
      to: `+91${mobileNumber}`
    });

    otpStore[mobileNumber] = otp;
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Twilio Error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP', error: error.message });
  }
});

// Route 3: Verify OTP
app.post('/verify-otp', (req, res) => {
  const { mobileNumber, otp } = req.body;

  if (!mobileNumber || !otp) {
    return res.status(400).json({ success: false, message: 'Mobile number and OTP required' });
  }

  if (otpStore[mobileNumber] === otp) {
    delete otpStore[mobileNumber]; // Clear OTP
    console.log(`Otp verified`);
    return res.json({ success: true, message: 'OTP verified successfully' });
  }
  console.log(otp);
  console.log(`Invalid Otp`);
  return res.status(400).json({ success: false, message: 'Invalid OTP' });
});

//---------------------------------------------------//
//security-pin check/

///
// ✅ 1. Store Mobile Number
// app.post('/store-mobile', (req, res) => {
//   const deleteQuery = `DELETE FROM user_details WHERE status = 'pending'`;

//   db.query(deleteQuery, (err, result) => {
//     if (err) {
//       console.error('❌ Delete error:', err);
//       return res.status(500).json({ success: false, message: 'Database error while deleting pending users' });
//     }

//     return res.status(200).json({
//       success: true,
//       message: `${result.affectedRows} pending users deleted successfully`
//     });
//   });
//   const { mobileNumber } = req.body;

//   if (!mobileNumber) {
//     return res.status(400).json({ success: false, message: 'Mobile number is required' });
//   }

//   const checkQuery = `SELECT * FROM user_details WHERE mobile_number = ?`;

//   db.query(checkQuery, [mobileNumber], (err, results) => {
//     if (err) {
//       console.error('❌ Database check error:', err);
//       return res.status(500).json({ success: false, message: 'Database error' });
//     }

//     if (results.length > 0) {
//       return res.status(200).json({
//         success: false,
//         message: 'Mobile number already exists. Please login.',
//         userExists: true
//       });
//     }

//     const insertQuery = `INSERT INTO user_details (mobile_number) VALUES (?)`;

//     db.query(insertQuery, [mobileNumber], (insertErr) => {
//       if (insertErr) {
//         console.error('❌ Insert error:', insertErr);
//         return res.status(500).json({ success: false, message: 'Insert error' });
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'Mobile number stored successfully'
//       });
//     });
//   });
// });

// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });
app.delete('/delete-pending-users', (req, res) => {
  const deleteQuery = `DELETE FROM user_details WHERE LOWER(TRIM(status)) = 'pending'`;

  db.query(deleteQuery, (deleteErr, deleteResult) => {  
    if (deleteErr) {
      console.error('❌ Delete error:', deleteErr);
      return res.status(500).json({ success: false, message: 'Database error while deleting pending users' });
    }

    console.log(`🗑️ Deleted ${deleteResult.affectedRows} pending users`);

    return res.status(200).json({
      success: true,
      message: `${deleteResult.affectedRows} pending users deleted successfully`
    });
  });
});

// ✅ POST: Store mobile number
app.post('/store-mobile', (req, res) => {
  const { mobileNumber } = req.body;

  if (!mobileNumber) {
    return res.status(400).json({ success: false, message: 'Mobile number is required' });
  }

  const checkQuery = `SELECT * FROM user_details WHERE mobile_number = ?`;
  db.query(checkQuery, [mobileNumber], (checkErr, results) => {
    if (checkErr) {
      console.error('❌ Check error:', checkErr);
      return res.status(500).json({ success: false, message: 'Database check error' });
    }

    if (results.length > 0) {
      return res.status(200).json({
        success: false,
        message: 'Mobile number already exists. Please login.',
        userExists: true
      });
    }
 
    const insertQuery = `INSERT INTO user_details (mobile_number, status) VALUES (?, 'pending')`;
    db.query(insertQuery, [mobileNumber], (insertErr) => {
      if (insertErr) {
        console.error('❌ Insert error:', insertErr);
        return res.status(500).json({ success: false, message: 'Insert error' });
      }

      return res.status(200).json({
        success: true,
        message: 'Mobile number stored successfully'
      });
    });
  });
});

// ✅ Dummy Send OTP
app.post('/send-otp', (req, res) => {
  const { mobileNumber } = req.body;

  // Replace with Twilio or real service
  if (!mobileNumber) {
    return res.status(400).json({ success: false, message: 'Mobile number is required' });
  }

  console.log(`📨 OTP sent to ${mobileNumber}`);
  res.status(200).json({ success: true, message: 'OTP sent successfully' });
});


// ✅ 2. Update User Details
app.post('/store-user-details', (req, res) => {
  const {
    deviceId,
    fullName,
    gender,
    dob,
    verifiedProof,
    schoolId,
    aadharNumber,
    ageCategory
  } = req.body;

  // if (!mobileNumber) {
  //   return res.status(400).json({ success: false, message: 'Mobile number is required' });
  // }

  const sql = `
    UPDATE user_details
    SET 
      full_name = ?, 
      gender = ?, 
      dob = ?, 
      verified_proof = ?, 
      school_id = ?, 
      aadhar_number = ?, 
      age_category = ?
    WHERE device_id = ?
  `;  //table change for unique okay
//   const sql = `
//   INSERT INTO user_details (
//     full_name, 
//     gender, 
//     dob, 
//     verified_proof, 
//     school_id, 
//     aadhar_number, 
//     age_category, 
//     mobile_number
//   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
// `;


  const values = [
    fullName,
    gender,
    dob,
    verifiedProof,
    schoolId || null,
    aadharNumber || null,
    ageCategory,
    deviceId
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('❌ Update Error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Mobile number not found' });
    }

    res.json({ success: true, message: 'User details updated successfully' });
  });
});

// ✅ 3. Set Security PIN (Plain Text Storage)
app.post('/set-security-pin', (req, res) => {
  const { mobileNumber, pin, deviceId} = req.body;

  if (!mobileNumber || !pin || !deviceId) {
    return res.status(400).json({ success: false, message: 'Mobile number, PIN, and device ID are required' });
  }

  const sql = `UPDATE user_details SET security_pin = ?, status = 'completed', device_id = ? WHERE mobile_number = ?`;

  db.query(sql, [pin, deviceId, mobileNumber], (err, result) => {
    if (err) {
      console.error('❌ PIN update error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Mobile number not found' });
    }

    res.json({ success: true, message: 'Security PIN saved successfully (plain text)' });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
app.get('/api/questions/:month', (req, res) => {
  const month = `Month ${req.params.month}`;
  db.query(
    'SELECT * FROM child_development WHERE month = ?',
    [month],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (rows.length === 0) return res.status(404).json({ error: 'No questions found' });

      const row = rows[0];
      const domains = [
        'comprehension', 'verbal_expression', 'non_verbal_expression',
        'physical_development', 'cognitive_development', 'fine_motor_skills',
        'gross_motor_skills', 'emotional_development', 'swallowing_development',
        'social_development'
      ];

      // const questions = domains
      //   .map(key => ({ domain: key, question: row[key] }))
      //   .filter(q => !!q.question); // remove empty

      // res.json({ month, questions });

      const questions = {};
      domains.forEach(key => {
        questions[key] = row[key];
      });
      questions['month'] = row['month'];
      
      res.json(questions);
    }
  );
});

app.post('/api/save-order', (req, res) => {
  const { products, address, paymentMethod, total, deviceId } = req.body;

  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ success: false, message: 'No products provided' });
  }

  const orderQuery = `
    INSERT INTO orders (address, payment_method, total, device_id)
    VALUES (?, ?, ?, ?)
  `;
  db.query(orderQuery, [address, paymentMethod, total, deviceId], (orderErr, orderResult) => {
    if (orderErr) {
      console.error('Order insert error:', orderErr);
      return res.status(500).json({ success: false, message: 'Server error (orders)' });
    }

    const orderId = orderResult.insertId;
    const itemValues = products.map(product => [
      orderId,
      product.id,
      product.title,
      product.variant,
      product.unitPrice,
      product.quantity,
      product.lineTotal
    ]);

    const itemsQuery = `
      INSERT INTO order_items
      (order_id, product_id, title, variant, unit_price, quantity, line_total)
      VALUES ?
    `;

    db.query(itemsQuery, [itemValues], (itemsErr, itemsResult) => {
      if (itemsErr) {
        console.error('Order items insert error:', itemsErr);
        return res.status(500).json({ success: false, message: 'Server error (order_items)' });
      }

      res.json({ success: true, message: 'Order saved successfully', orderId });
    });
  });
});

app.get('/products', (req, res) => {
  const sql = 'SELECT * FROM products';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


app.post('/save-session', (req, res) => {
  const {
    name,
    sessionType,
    sessiondate,
    sessiontime,
    meetLink,
    eventId,
    completed,
    fullName,
    age,
    gender,
    deviceId,
  } = req.body;

  // Validation
  if (!name || !sessionType || !sessiondate || !sessiontime || !fullName || !deviceId) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const sql = `
    INSERT INTO session_details (
      name,
      session_type,
      session_date,
      session_time,
      meet_link,
      event_id,
      completed,
      full_name,
      age,
      gender,
      device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    name,
    sessionType,
    sessiondate,
    sessiontime,
    meetLink || '',
    eventId || '',
    completed ? 1 : 0,
    fullName,
    age || null,
    gender || null,
    deviceId,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('❌ Error inserting session:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    res.json({ success: true, message: 'Session saved successfully' });
  });
});

app.post('/get-sessions', (req, res) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({ success: false, message: 'Missing deviceId' });
  }

  const sql = `SELECT * FROM session_details WHERE device_id = ? ORDER BY session_date DESC`;

  db.query(sql, [deviceId], (err, results) => {
    if (err) {
      console.error('❌ Error fetching sessions:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    res.json({ success: true, sessions: results });
  });
});


app.post('/orders', (req, res) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: 'Device ID is required' });
  }

  const orderQuery = 'SELECT * FROM orders WHERE device_id = ? ORDER BY created_at DESC';
  const itemsQuery = 'SELECT * FROM order_items';

  db.query(orderQuery, [deviceId], (err, orders) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }

    db.query(itemsQuery, (err, items) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch order items' });
      }

      const result = orders.map((order) => {
        const orderItems = items.filter((item) => item.order_id === order.order_id);
        return { ...order, items: orderItems };
      });

      res.json(result);
    });
  });
});




app.post('/get-user-details', (req, res) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({ success: false, message: 'Device ID is required' });
  }

  const sql = `SELECT full_name, mobile_number FROM user_details WHERE device_id = ?`;

  db.query(sql, [deviceId], (err, results) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user: results[0] });
  });
});


app.post('/update-user-name', (req, res) => {
  const { deviceId, fullName } = req.body;

  if (!deviceId || !fullName) {
    return res.status(400).json({ success: false, message: 'Device ID and full name are required' });
  }

  const sql = `UPDATE user_details SET full_name = ? WHERE device_id = ?`;

  db.query(sql, [fullName, deviceId], (err, result) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'Name updated successfully' });
  });
});

app.post('/update-profile-image', (req, res) => {
  const { deviceId, imageBase64 } = req.body;

  if (!deviceId || !imageBase64) {
    return res.status(400).json({ success: false, message: 'Missing deviceId or imageBase64' });
  }

  const sql = `UPDATE user_details SET profile_image = ? WHERE device_id = ?`;

  db.query(sql, [imageBase64, deviceId], (err, result) => {
    if (err) {
      console.error('❌ Error updating profile image:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'Profile image updated' });
  });
});

app.post('/get-profile-image', (req, res) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({ success: false, message: 'Device ID required' });
  }

  const sql = `SELECT profile_image FROM user_details WHERE device_id = ?`;

  db.query(sql, [deviceId], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, imageBase64: results[0].profile_image });
  });
});



app.get('/api/questions_tamil/:month', (req, res) => {
  const month = `Month ${req.params.month}`;
  db.query(
    'SELECT * FROM child_development_tamil WHERE month = ?',
    [month],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (rows.length === 0) return res.status(404).json({ error: 'No tamil questions found' });

      const row = rows[0];
      const domains = [
        'comprehension', 'verbal_expression', 'non_verbal_expression',
        'physical_development', 'cognitive_development', 'fine_motor_skills',
        'gross_motor_skills', 'emotional_development', 'swallowing_development',
        'social_development'
      ];

      // Return as a flat object, matching your frontend expectation
      const tamilQuestions = {};
      domains.forEach(key => {
        tamilQuestions[key] = row[key];
      });

      tamilQuestions['month'] = row['month'];

      res.json(tamilQuestions);
    }
  );
});

//2
// Inside server.js

// Inside server.js
app.post('/submit-answers', (req, res) => {
  const { username, mobileNumber, answers } = req.body;

  const query = `
    INSERT INTO user_domain_answers (
      username, mobileNumber,
      comprehension_q, comprehension_a,
      verbal_expression_q, verbal_expression_a,
      non_verbal_expression_q, non_verbal_expression_a,
      physical_development_q, physical_development_a,
      cognitive_development_q, cognitive_development_a,
      fine_motor_skills_q, fine_motor_skills_a,
      gross_motor_skills_q, gross_motor_skills_a,
      emotional_development_q, emotional_development_a,
      swallowing_development_q, swallowing_development_a,
      social_development_q, social_development_a
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    username,
    mobileNumber,
    answers.comprehension?.question || '',
    answers.comprehension?.answer || '',
    answers.verbal_expression?.question || '',
    answers.verbal_expression?.answer || '',
    answers.non_verbal_expression?.question || '',
    answers.non_verbal_expression?.answer || '',
    answers.physical_development?.question || '',
    answers.physical_development?.answer || '',
    answers.cognitive_development?.question || '',
    answers.cognitive_development?.answer || '',
    answers.fine_motor_skills?.question || '',
    answers.fine_motor_skills?.answer || '',
    answers.gross_motor_skills?.question || '',
    answers.gross_motor_skills?.answer || '',
    answers.emotional_development?.question || '',
    answers.emotional_development?.answer || '',
    answers.swallowing_development?.question || '',
    answers.swallowing_development?.answer || '',
    answers.social_development?.question || '',
    answers.social_development?.answer || ''
  ];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Database insert failed:', err);
      return res.status(500).json({
        success: false,
        message: 'Database insert failed.',
        error: err.sqlMessage || err.message
      });
    }

    res.json({ success: true, message: 'Answers submitted successfully' });
  });
});
//all user show
app.get('/api/all-users', (req, res) => {
  const query = 'SELECT * FROM user_details ORDER BY id ASC';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(results);
    console.log(res.json(results))
  });
});
//3)
app.get('/api/user-domain-answers/:mobile', (req, res) => {
  const { mobile } = req.params;

  const query = 'SELECT * FROM user_domain_answers WHERE mobileNumber = ? LIMIT 1';
  db.query(query, [mobile], (err, result) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (result.length === 0) {
      return res.status(404).json({ error: 'No data found' });
    }
    res.json(result[0]);
  });
});
//show question
app.get('/api/showquestions', (req, res) => {
  const query = `
select*from child_development`;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching questions:', err);
      return res.status(500).json({ error: 'Server error' });
    }
    //console.log(results)
    res.json(results);
  });
});
//admin verify
app.post('/api/admin-login', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM admin_users WHERE email = ? AND password = ?';

  db.query(query, [email, password], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error' });

    if (results.length > 0) {
      res.status(200).json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  });
});


//admin pass change

// Change Password Route
app.post('/api/change-password', (req, res) => {
  const { email, oldPassword, newPassword } = req.body;

  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const checkUserQuery = 'SELECT * FROM admin_users WHERE email = ?';
  db.query(checkUserQuery, [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(404).json({ message: 'Admin not found' });

    const admin = results[0];
    if (admin.password !== oldPassword) {
      return res.status(401).json({ message: 'Incorrect old password' });
    }

    const updateQuery = 'UPDATE admin_users SET password = ? WHERE email = ?';
    db.query(updateQuery, [newPassword, email], (updateErr) => {
      if (updateErr) return res.status(500).json({ message: 'Update failed' });
      res.json({ message: 'Password changed successfully' });
    });
  });
});
//filter question
app.get('/api/questions', (req, res) => {
  const { month } = req.query;
  let query = 'SELECT * FROM child_development';
  const params = [];

  if (month) {
    query += ' WHERE month = ?';
    params.push(month);
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('❌ Error fetching questions:', err);
      return res.status(500).json({ error: 'Failed to fetch questions' });
    }
    res.json(results);
  });
});

// API: Update question field
app.put('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  const { field, value } = req.body;

  // Validate inputs
  if (!field || typeof value !== 'string') {
    return res.status(400).json({ error: 'Invalid field or value' });
  }

  const query = `UPDATE child_development SET ?? = ? WHERE id = ?`;
  const values = [field, value, id];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('❌ Update error:', err);
      return res.status(500).json({ error: 'Failed to update question' });
    }
    res.json({ message: '✅ Question updated successfully' });
  });
});


//security pin
  app.post('/api/verify-pin', (req, res) => {
    const { deviceId, securityPIN } = req.body;

    if (!deviceId || !securityPIN) {
      return res.status(400).json({ success: false, message: 'Id and PIN required' });
    }

    const query = 'SELECT security_pin FROM user_details WHERE device_Id = ?';
    db.query(query, [deviceId], (err, results) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const storedPin = results[0].security_pin;
      if (securityPIN === storedPin) {
        return res.json({ success: true, message: 'PIN verified' });
      } else {
        return res.json({ success: false, message: 'Incorrect PIN' });
      }
    });
  });

// app.post('/verify-pin', (req, res) => {
//   const { securityPIN } = req.body;

//   if (!securityPIN) {
//     return res.status(400).json({ success: false, message: 'PIN required' });
//   }

//   const query = 'SELECT mobile_number FROM user_details WHERE security_pin = ?';
//   db.query(query, [securityPIN], (err, results) => {
//     if (err) {
//       console.error('DB error:', err);
//       return res.status(500).json({ success: false, message: 'Database error' });
//     }

//     if (results.length === 0) {
//       return res.status(404).json({ success: false, message: 'Incorrect PIN' });
//     }

//     // Optionally, you can return the mobile number or just success
//     return res.json({ success: true, message: 'PIN verified', mobileNumber: results[0].mobile_number });
//   });
// });

app.post('/reset-pin', (req, res) => {
  const { mobileNumber, newPin } = req.body;

    const updateQuery = 'UPDATE user_details SET security_pin = ? WHERE mobile_number = ?';
    db.query(updateQuery, [newPin, mobileNumber], (err, result) => {
      if (err) {
        console.error('PIN update error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
    res.json({ success: true, message: 'PIN reset successfully' });
  });
});

// Create payment order endpoint
app.post('/create-order', async (req, res) => {
  const { amount, currency = 'INR', receipt = 'receipt_001' } = req.body;

  try {
    const order = await razorpay.orders.create({
      amount: amount * 100, // Amount in paise
      currency,
      receipt,
    });

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify payment signature endpoint
app.post('/verify-payment', (req, res) => {
  const { order_id, payment_id, signature } = req.body;

  const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  hmac.update(`${order_id}|${payment_id}`);
  const digest = hmac.digest('hex');

  if (digest === signature) {
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: 'Signature verification failed' });
  }
});

// Load client secrets from a local file
const credentials = require('./client.apps.googleusercontent.com.json');
const { client_id, client_secret, redirect_uris } = credentials.web;

const oAuth2Client = new google.auth.OAuth2(
  client_id, client_secret, redirect_uris[0]
);

// Load previously stored token
const TOKEN_PATH = 'token.json';
if (fs.existsSync(TOKEN_PATH)) {
  oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
} else {
  // Manual step: run this code once to generate token.json
  // const authUrl = oAuth2Client.generateAuthUrl({
  //   access_type: 'offline',
  //   prompt: 'consent',
  //   scope: ['https://www.googleapis.com/auth/calendar'],
  //   redirect_uri: 'https://anvayam.onrender.com/oauth2callback'
  // });
  // console.log('Authorize this app by visiting this url:', authUrl);
  // After visiting the URL and authorizing, paste the code here and save the token as token.json
  //process.exit(1);
}

const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

app.post('/api/create_meet', async (req, res) => {
  const { summary, startTime, endTime } = req.body;
  try {
    const event = {
      summary,
      start: { 
        dateTime: startTime,
        timeZone: 'Asia/Kolkata' 
      },
      end: { 
        dateTime: endTime,
        timeZone: 'Asia/Kolkata' 
      },
      conferenceData: {
        createRequest: { requestId: Math.random().toString(36).substring(2) }
      }
    };
    console.log('Creating event:', event);
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
    });
    res.json({ 
      meetLink: response.data.hangoutLink,
      eventId: response.data.id
     });
     console.log('Link : ',response.data.hangoutLink);
  } catch (e) {
  console.error('Google API error:', e.response?.data || e);
  res.status(500).json({ error: 'Failed to create Google Meet' });
}
});

app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  const { tokens } = await oAuth2Client.getToken({
    code,
    redirect_uri: 'https://anvayam.onrender.com/oauth2callback'
  });
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync('token.json', JSON.stringify(tokens));
  console.log(tokens);
  res.send('Authorization successful! You can close this window.');
});

app.post('/api/delete_meet', async (req, res) => {
  const { eventId } = req.body;
  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });
    console.log('Event Deleted');
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to delete event:', e.response?.data || e);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});


