const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS org_chart_state (
      id INTEGER PRIMARY KEY,
      employees JSONB NOT NULL,
      open_jobs JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

app.get("/api/state", async (req, res) => {
  try {
    await ensureTable();

    const result = await pool.query(
      "SELECT employees, open_jobs, updated_at FROM org_chart_state WHERE id = 1"
    );

    res.set("Cache-Control", "no-store");

    if (!result.rows.length) {
      return res.status(204).end();
    }

    const row = result.rows[0];

    res.json({
      employees: row.employees,
      openJobs: row.open_jobs,
      updatedAt: row.updated_at
    });

  } catch (err) {
    console.error("GET /api/state failed:", err);

    res.status(500).json({
      error: "Could not load shared org chart."
    });
  }
});

app.put("/api/state", async (req, res) => {
  try {
    const { employees, openJobs } = req.body || {};

    if (!Array.isArray(employees) || !Array.isArray(openJobs)) {
      return res.status(400).json({
        error: "employees and openJobs must both be arrays"
      });
    }

    await ensureTable();

    await pool.query(
      `INSERT INTO org_chart_state
        (id, employees, open_jobs, updated_at)

       VALUES
        (1, $1::jsonb, $2::jsonb, NOW())

       ON CONFLICT (id)
       DO UPDATE SET
         employees = EXCLUDED.employees,
         open_jobs = EXCLUDED.open_jobs,
         updated_at = NOW()`,
      [
        JSON.stringify(employees),
        JSON.stringify(openJobs)
      ]
    );

    res.json({
      ok: true
    });

  } catch (err) {
    console.error("PUT /api/state failed:", err);

    res.status(500).json({
      error: "Could not save shared org chart."
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `CHC Org Chart running on port ${PORT}`
  );
});
