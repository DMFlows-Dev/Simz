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
    } else if (from) {
      sql += ` AND cl.start_time >= ?`;
      params.push(from);
    } else if (to) {
      sql += ` AND cl.start_time < DATE_ADD(?, INTERVAL 1 DAY)`;
      params.push(to);
    }

    sql += ` ORDER BY cl.start_time DESC`;

    const [rows] = await db.query(sql, params);

    return res.json({
      message: rows.length ? 'Call lengths fetched successfully' : 'No calls found for the given filters',
      company_id: company_id || 'ALL',
      from: from || null,
      to: to || null,
      data: rows
    });
  } catch (error) {
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
      failed_calls: Number(r.failed_calls || 0),
      total_calls: Number(r.total_calls || 0),
      success_pct: Number(r.success_pct || 0),
      failed_pct: Number(r.failed_pct || 0),
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

// GET /api/concurrent-calls?from=YYYY-MM-DD&to=YYYY-MM-DD&company_id=comp_0001
exports.getConcurrentCalls = async (req, res) => {
  try {
    const { from, to, company_id, limit } = req.query;

    // Build WHERE + params (all optional)
    let where = 'WHERE 1=1';
    const params = [];

    if (company_id) {
      where += ' AND Company_ID = ?';
      params.push(company_id);
    }
    if (from && to) {
      where += ' AND Call_DateTime >= ? AND Call_DateTime < DATE_ADD(?, INTERVAL 1 DAY)';
      params.push(from, to);
    } else if (from) {
      where += ' AND Call_DateTime >= ?';
      params.push(from);
    } else if (to) {
      where += ' AND Call_DateTime < DATE_ADD(?, INTERVAL 1 DAY)';
      params.push(to);
    }

    // If NO filters -> return ALL grouped rows (no LIMIT)
    // If any filter is present -> default LIMIT 1 (peak only), unless ?limit=N is provided
    const noFilters = !company_id && !from && !to;
    // const useLimit = noFilters ? '' : `LIMIT ${Number(limit) > 0 ? Number(limit) : 1}`;

    const sql = `
      SELECT
        DATE_FORMAT(Call_DateTime, '%Y-%m-%d %H:%i:00') AS call_time,
        COUNT(*) AS concurrent_calls
      FROM calls
      ${where}
      GROUP BY call_time
      HAVING concurrent_calls > 1
      ORDER BY concurrent_calls DESC, call_time DESC;
    `;
    console.log(sql)
    const [rows] = await db.query(sql, params);

    res.json({
      message: noFilters
        ? 'All concurrent call minutes (desc by count)'
        : (Number(limit) > 1 ? `Top ${Number(limit)} concurrent minutes` : 'Peak concurrent minute'),
      company_id: company_id || 'ALL',
      from: from || null,
      to: to || null,
      data: rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
};



exports.getPeakCallTimes = async (req, res) => {
  try {
    const { from, to, company_id } = req.query;

    // metadata to echo back in response (nulls if missing)
    const meta = {
      company_id: company_id ?? null,
      from: from ?? null,
      to: to ?? null
    };

    let sql = `
      SELECT 
        DATE_FORMAT(Call_DateTime, '%Y-%m-%d %H:00:00') AS hour_slot,
        COUNT(*) AS total_calls
      FROM calls
      WHERE 1=1
    `;
    const params = [];

    if (company_id) {
      sql += ' AND Company_ID = ?';
      params.push(company_id);
    }
    if (from && to) {
      sql += ' AND Call_DateTime >= ? AND Call_DateTime < DATE_ADD(?, INTERVAL 1 DAY)';
      params.push(from, to);
    } else if (from) {
      sql += ' AND Call_DateTime >= ?';
      params.push(from);
    } else if (to) {
      sql += ' AND Call_DateTime < DATE_ADD(?, INTERVAL 1 DAY)';
      params.push(to);
    }

    sql += `
      GROUP BY hour_slot
      ORDER BY total_calls DESC
      LIMIT 10
    `;

    const [rows] = await db.query(sql, params);

    if (rows.length > 0) {
      return res.json({
        message: 'Top 10 peak call times fetched successfully',
        ...meta,
        data: rows
      });
    }
    return res.json({
      message: 'No calls found for the given filters',
      ...meta
    });

  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
};








// Total call time (sums duration). If Call_Duration is NULL, we try start/end.
// GET /api/total-call-time
// ?date=2025-09-05
// ?month=2025-09
// ?year=2025
// (optional) &company_id=comp_0001
// helper to YYYY-MM-DD


// helper to output "ALL" when a value is missing
const asALL = v => (v === undefined || v === null || v === '' ? 'ALL' : v);

// helper to format Date -> YYYY-MM-DD
const fmtDate = d => {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${m}-${day}`;
};

exports.getTotalCallTime = async (req, res) => {
  try {
    const { company_id, date, month, year, from, to } = req.query;

    // Base WHERE
    let where = 'WHERE 1=1';
    const params = [];

    if (company_id) {
      where += ' AND Company_ID = ?';
      params.push(company_id);
    }

    // Prefer stored duration; otherwise compute from Call_DateTime -> End_Time
    const sumExpr = `
      SUM(
        COALESCE(
          Call_Duration,
          TIMESTAMPDIFF(SECOND, Call_DateTime, End_Time),
          0
        )
      )
    `;

    /* ============ RANGE MODE (from / to) ============ */
    if (from || to) {
      let w = where;
      const p = [...params];

      if (from && to) {
        // inclusive end-day
        w += ' AND Call_DateTime >= ? AND Call_DateTime < DATE_ADD(?, INTERVAL 1 DAY)';
        p.push(from, to);
      } else if (from) {
        w += ' AND Call_DateTime >= ?';
        p.push(from);
      } else if (to) {
        w += ' AND Call_DateTime < DATE_ADD(?, INTERVAL 1 DAY)';
        p.push(to);
      }

      const sql = `
        SELECT
          ${sumExpr} AS total_seconds,
          SEC_TO_TIME(${sumExpr}) AS total_hms
        FROM calls
        ${w}
      `;
      const [rows] = await db.query(sql, p);
      const r = rows[0] || { total_seconds: 0, total_hms: '00:00:00' };

      return res.json({
        mode: 'range',
        company_id: asALL(company_id),
        from: asALL(from),
        to: asALL(to),
        total_seconds: Number(r.total_seconds || 0),
        total_hms: r.total_hms || '00:00:00'
      });
    }

    /* ============ DAY MODE (date=YYYY-MM-DD) ============ */
    if (date) {
      const w = `${where} AND DATE(Call_DateTime) = ?`;
      const p = [...params, date];

      const sql = `
        SELECT
          ${sumExpr} AS total_seconds,
          SEC_TO_TIME(${sumExpr}) AS total_hms
        FROM calls
        ${w}
      `;
      const [rows] = await db.query(sql, p);
      const r = rows[0] || { total_seconds: 0, total_hms: '00:00:00' };

      return res.json({
        mode: 'day',
        company_id: asALL(company_id),
        from: date,
        to: date,
        total_seconds: Number(r.total_seconds || 0),
        total_hms: r.total_hms || '00:00:00'
      });
    }

    /* ============ MONTH MODE (month=YYYY-MM) ============ */
    if (month) {
      const start = `${month}-01`;
      // compute last day of given month
      const [yr, mo] = month.split('-').map(Number);
      const endDate = new Date(yr, mo, 0); // last day of that month
      const end = fmtDate(endDate);

      const w = `${where} AND Call_DateTime >= ? AND Call_DateTime < DATE_ADD(?, INTERVAL 1 MONTH)`;
      const p = [...params, start, start];

      const sql = `
        SELECT
          ${sumExpr} AS total_seconds,
          SEC_TO_TIME(${sumExpr}) AS total_hms
        FROM calls
        ${w}
      `;
      const [rows] = await db.query(sql, p);
      const r = rows[0] || { total_seconds: 0, total_hms: '00:00:00' };

      return res.json({
        mode: 'month',
        company_id: asALL(company_id),
        from: start,
        to: end,
        total_seconds: Number(r.total_seconds || 0),
        total_hms: r.total_hms || '00:00:00'
      });
    }

    /* ============ YEAR MODE (year=YYYY) ============ */
    if (year) {
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;

      const w = `${where} AND Call_DateTime >= ? AND Call_DateTime < DATE_ADD(?, INTERVAL 1 YEAR)`;
      const p = [...params, start, start];

      const sql = `
        SELECT
          ${sumExpr} AS total_seconds,
          SEC_TO_TIME(${sumExpr}) AS total_hms
        FROM calls
        ${w}
      `;
      const [rows] = await db.query(sql, p);
      const r = rows[0] || { total_seconds: 0, total_hms: '00:00:00' };

      return res.json({
        mode: 'year',
        company_id: asALL(company_id),
        from: start,
        to: end,
        total_seconds: Number(r.total_seconds || 0),
        total_hms: r.total_hms || '00:00:00'
      });
    }

    /* ============ ROLLUPS (no filters) ============ */
    const sqlDay = `
      SELECT DATE(Call_DateTime) AS day,
             ${sumExpr} AS total_seconds,
             SEC_TO_TIME(${sumExpr}) AS total_hms
      FROM calls
      ${where}
      GROUP BY day
      ORDER BY day;
    `;
    const sqlMonth = `
      SELECT DATE_FORMAT(Call_DateTime, '%Y-%m') AS ym,
             ${sumExpr} AS total_seconds,
             SEC_TO_TIME(${sumExpr}) AS total_hms
      FROM calls
      ${where}
      GROUP BY ym
      ORDER BY ym;
    `;
    const sqlYear = `
      SELECT YEAR(Call_DateTime) AS y,
             ${sumExpr} AS total_seconds,
             SEC_TO_TIME(${sumExpr}) AS total_hms
      FROM calls
      ${where}
      GROUP BY y
      ORDER BY y;
    `;

    const [perDay] = await db.query(sqlDay, [...params]);
    const [perMonth] = await db.query(sqlMonth, [...params]);
    const [perYear] = await db.query(sqlYear, [...params]);

   return res.json({
 
  company_id: asALL(company_id), // stays "ALL" if missing
  from: null,                    // <-- was "ALL"
  to: null,                      // <-- was "ALL"
  perDay,
  perMonth,
  perYear
});
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
};



// GET /api/billing-rows?company_id=comp_0001&from=2025-08-01&to=2025-08-31
// GET /api/billing-totals?company_id=comp_0001&from=2025-08-01&to=2025-08-31
exports.getBillingTable = async (req, res) => {
  try {
    const { company_id, from, to } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (company_id) {
      where += ' AND Company_ID = ?';
      params.push(company_id);
    }
    if (from && to) {
      where += ' AND Call_DateTime >= ? AND Call_DateTime < DATE_ADD(?, INTERVAL 1 DAY)';
      params.push(from, to);
    } else if (from) {
      where += ' AND Call_DateTime >= ?';
      params.push(from);
    } else if (to) {
      where += ' AND Call_DateTime < DATE_ADD(?, INTERVAL 1 DAY)';
      params.push(to);
    }

    const sql = `
      SELECT
        Company_ID AS company_id,
        ROUND(
          SUM(COALESCE(Call_Duration, TIMESTAMPDIFF(SECOND, Call_DateTime, End_Time), 0)) / 60, 2
        ) AS minutes
      FROM calls
      ${where}
      GROUP BY Company_ID
      ORDER BY minutes DESC
    `;

    const [rows] = await db.query(sql, params);
    res.json({
      message: 'Total minutes by company',
      filters: { company_id: company_id || 'ALL', from: from || null, to: to || null },
      data: rows
    });
  } catch (e) {
    res.status(500).json({ error: 'Database error', details: e.message });
  }
};
