const db = require('../config/db');

exports.getDbCheck = async (req, res) => {
  try {
    const [callLengths] = await db.query('SELECT * FROM calls');
    res.json(callLengths);
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error });
  }
};

//call length
exports.getCallLengths = async (req, res) => {
  try {
    const { from, to, company_id } = req.query;
    const params = [];

    let sql = `
      SELECT
          cl.phone_number,
          cl.call_direction,
          cl.call_status,
          ca.Agent_Name       AS agent_name,
          c.Client_Name       AS client_name,
          co.Company_Name     AS company_name,
          cl.start_time,
          cl.end_time,
          cl.duration_seconds AS call_length_seconds
      FROM call_logs cl
      LEFT JOIN call_agents ca ON cl.agent_id   = ca.Agent_ID
      LEFT JOIN calls       c  ON cl.call_id    = c.Call_ID
      LEFT JOIN companies   co ON cl.company_id = co.Company_ID
      WHERE 1=1
    `;

    if (company_id) {
      sql += ` AND cl.company_id = ?`;
      params.push(company_id);
    }
    if (from && to) {
      sql += ` AND cl.start_time >= ? AND cl.start_time < DATE_ADD(?, INTERVAL 1 DAY)`;
      params.push(from, to);
    }

    sql += ` ORDER BY cl.start_time DESC`;  //latest most recent calls

    // Debug: verify which SQL is actually running
    console.log('[getCallLengths] SQL:', sql, 'PARAMS:', params);

    const [rows] = await db.query(sql, params);
    return res.json({
      company_id: company_id || 'ALL',
      from: from || null,
      to: to || null,
      count: rows.length,
      calls: rows
    });
  } catch (error) {
    console.error('[getCallLengths] ERROR:', error);
    res.status(500).json({ error: 'Database error', details: error.message });
  }
};

//call rates 
exports.getCallRates = async (req, res) => {
  try {
    const { from, to, company_id } = req.query;

    let sql = `
      SELECT
        IFNULL(SUM(call_status = 'Completed'), 0) AS success_calls,
        IFNULL(SUM(call_status = 'Failed'),    0) AS failed_calls,
        IFNULL(COUNT(*), 0)                     AS total_calls,
        IFNULL(ROUND(100 * SUM(call_status = 'Completed') / NULLIF(COUNT(*), 0), 2), 0) AS success_pct,
        IFNULL(ROUND(100 * SUM(call_status = 'Failed')    / NULLIF(COUNT(*), 0), 2), 0) AS failed_pct
      FROM call_logs
      WHERE 1=1
    `;

    const params = [];

    // filter by company only if provided
    if (company_id) {
      sql += ` AND Company_ID = ?`;
      params.push(company_id);
    }

    // filter by date only if both from/to provided
    if (from && to) {
      sql += ` AND Created_At >= ? AND Created_At < DATE_ADD(?, INTERVAL 1 DAY)`;
      params.push(from, to);
    }

    const [rows] = await db.query(sql, params);
    const r = rows[0] || {};

    return res.json({
      company_id: company_id || 'ALL',
      success_calls: Number(r.success_calls || 0),
      failed_calls:  Number(r.failed_calls || 0),
      total_calls:   Number(r.total_calls  || 0),
      success_pct:   Number(r.success_pct  || 0),
      failed_pct:    Number(r.failed_pct   || 0),
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
};






// GET /api/avg-call-time?from=YYYY-MM-DD&to=YYYY-MM-DD&company_id=comp_0001
exports.getAvgCallTime = async (req, res) => {
  try {
    const { from, to, company_id } = req.query;
    const params = [];

    let sql = `
      SELECT
          ROUND(AVG(cl.duration_seconds), 2) AS avg_call_duration_seconds
      FROM call_logs cl
      WHERE cl.duration_seconds IS NOT NULL
    `;

    if (company_id) {
      sql += ` AND cl.company_id = ?`;
      params.push(company_id);
    }

    if (from && to) {
      sql += ` AND cl.start_time >= ? AND cl.start_time < DATE_ADD(?, INTERVAL 1 DAY)`;
      params.push(from, to);
    }

    const [rows] = await db.query(sql, params);
    const avg = rows[0]?.avg_call_duration_seconds || 0;

    res.json({
      company_id: company_id || 'ALL',
      from: from || null,
      to: to || null,
      avg_call_duration_seconds: Number(avg)
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
};


// GET /api/answer-machine-detection?from=YYYY-MM-DD&to=YYYY-MM-DD&company_id=comp_0001
// GET /api/answer-machine-detection?from=YYYY-MM-DD&to=YYYY-MM-DD&company_id=comp_0001
exports.getAnswerMachineDetection = async (req, res) => {
  try {
    const { from, to, company_id } = req.query;
    const params = [];

    let sql = `
      SELECT
        SUM(CASE WHEN AMD_Result LIKE '%machine%' THEN 1 ELSE 0 END) AS machine_count,
        SUM(CASE WHEN AMD_Result LIKE '%human%'  THEN 1 ELSE 0 END) AS human_count,
        COUNT(*)                                                     AS total_rows
      FROM calls
      WHERE 1=1
    `;

    if (company_id) {
      sql += ` AND Company_ID = ?`;
      params.push(company_id);
    }

    /* Use the date column that exists in your schema.
       From your screenshot, End_Time is present.
       If you prefer Start_Time/Created_At, swap the column name below. */
    if (from && to) {
      sql += ` AND End_Time >= ? AND End_Time < DATE_ADD(?, INTERVAL 1 DAY)`;
      params.push(from, to);
    }

    const [rows] = await db.query(sql, params);
    const r = rows[0] || {};
    res.json({
      company_id: company_id || 'ALL',
      from: from || null,
      to: to || null,
      machine_count: Number(r.machine_count || 0),
      human_count: Number(r.human_count || 0),
      total_rows: Number(r.total_rows || 0)
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
};


exports.getConcurrentCalls = async (req, res) => {
  try {
    const [concurrent] = await db.query("SELECT MAX(concurrent_calls) AS max_concurrent FROM call_concurrency");
    res.json({ max_concurrent: concurrent[0].max_concurrent });
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
};

exports.getPeakCallTimes = async (req, res) => {
  try {
    const [peak] = await db.query("SELECT HOUR(start_time) AS hour, COUNT(*) AS count FROM calls GROUP BY hour ORDER BY count DESC LIMIT 1");
    res.json(peak[0]);
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
};

exports.getTotalCallTime = async (req, res) => {
  try {
    const [totalMonth] = await db.query("SELECT MONTH(start_time) AS month, SUM(duration) AS total FROM calls GROUP BY month");
    const [totalDay] = await db.query("SELECT DAY(start_time) AS day, SUM(duration) AS total FROM calls GROUP BY day");
    const [totalYear] = await db.query("SELECT YEAR(start_time) AS year, SUM(duration) AS total FROM calls GROUP BY year");
    res.json({ perMonth: totalMonth, perDay: totalDay, perYear: totalYear });
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
};

exports.getBillingTable = async (req, res) => {
  try {
    const [billing] = await db.query("SELECT id, duration, billed_amount, rate, start_time FROM billing");
    res.json(billing);
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
};
