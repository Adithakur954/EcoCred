import express from 'express';
import pool from '../db.js';

const router = express.Router();

// ── Helper: convert range string to PostgreSQL interval ──────────────────────
const rangeToInterval = (range) => {
  switch (range) {
    case '24h': return '24 hours';
    case '30d': return '30 days';
    default:    return '7 days';   // '7d'
  }
};

// ── Helper: hour bucket for 24h vs day bucket for 7d/30d ────────────────────
const rangeTrunc = (range) => {
  return range === '24h' ? 'hour' : 'day';
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dataset/summary
// Returns overall averages: avgUse, avgGen, avgSolar, netBalance
// ─────────────────────────────────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ROUND(AVG(use_kw)::numeric, 4)    AS "avgUse",
        ROUND(AVG(gen_kw)::numeric, 4)    AS "avgGen",
        ROUND(AVG(solar)::numeric, 4)     AS "avgSolar",
        ROUND((AVG(gen_kw) - AVG(use_kw))::numeric, 4) AS "netBalance",
        COUNT(*) AS "totalReadings",
        MIN(time) AS "from",
        MAX(time) AS "to"
      FROM energy_readings
      WHERE use_kw IS NOT NULL
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dataset/timeseries?range=7d
// Returns bucketed time series: { labels, use, gen, solar }
// ─────────────────────────────────────────────────────────────────────────────
router.get('/timeseries', async (req, res) => {
  const range = req.query.range || '7d';
  const interval = rangeToInterval(range);
  const trunc = rangeTrunc(range);

  try {
    const result = await pool.query(`
      SELECT
        DATE_TRUNC($1, time) AS bucket,
        ROUND(AVG(use_kw)::numeric, 3)  AS use_kw,
        ROUND(AVG(gen_kw)::numeric, 3)  AS gen_kw,
        ROUND(AVG(solar)::numeric, 3)   AS solar
      FROM energy_readings
      WHERE time >= NOW() - INTERVAL '${interval}'
        AND use_kw IS NOT NULL
      GROUP BY bucket
      ORDER BY bucket ASC
      LIMIT 60
    `, [trunc]);

    const rows = result.rows;
    const labels = rows.map(r => {
      const d = new Date(r.bucket);
      return trunc === 'hour'
        ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    res.json({
      success: true,
      data: {
        labels,
        use:   rows.map(r => parseFloat(r.use_kw) || 0),
        gen:   rows.map(r => parseFloat(r.gen_kw) || 0),
        solar: rows.map(r => parseFloat(r.solar)  || 0),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dataset/appliances
// Returns per-appliance averages sorted descending
// ─────────────────────────────────────────────────────────────────────────────
router.get('/appliances', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ROUND(AVG(house_overall)::numeric, 4) AS house_overall,
        ROUND(AVG(dishwasher)::numeric, 4)    AS dishwasher,
        ROUND(AVG(furnace1)::numeric, 4)      AS furnace1,
        ROUND(AVG(furnace2)::numeric, 4)      AS furnace2,
        ROUND(AVG(home_office)::numeric, 4)   AS home_office,
        ROUND(AVG(fridge)::numeric, 4)        AS fridge,
        ROUND(AVG(wine_cellar)::numeric, 4)   AS wine_cellar,
        ROUND(AVG(garage_door)::numeric, 4)   AS garage_door,
        ROUND(AVG(kitchen12)::numeric, 4)     AS kitchen12,
        ROUND(AVG(kitchen14)::numeric, 4)     AS kitchen14,
        ROUND(AVG(kitchen38)::numeric, 4)     AS kitchen38,
        ROUND(AVG(barn)::numeric, 4)          AS barn,
        ROUND(AVG(well)::numeric, 4)          AS well,
        ROUND(AVG(microwave)::numeric, 4)     AS microwave,
        ROUND(AVG(living_room)::numeric, 4)   AS living_room
      FROM energy_readings
    `);

    const row = result.rows[0];
    const appliances = [
      { name: 'House Overall', avgKw: parseFloat(row.house_overall) || 0 },
      { name: 'Furnace 1',     avgKw: parseFloat(row.furnace1)      || 0 },
      { name: 'Furnace 2',     avgKw: parseFloat(row.furnace2)      || 0 },
      { name: 'Dishwasher',    avgKw: parseFloat(row.dishwasher)    || 0 },
      { name: 'Barn',          avgKw: parseFloat(row.barn)          || 0 },
      { name: 'Home Office',   avgKw: parseFloat(row.home_office)   || 0 },
      { name: 'Fridge',        avgKw: parseFloat(row.fridge)        || 0 },
      { name: 'Wine Cellar',   avgKw: parseFloat(row.wine_cellar)   || 0 },
      { name: 'Well',          avgKw: parseFloat(row.well)          || 0 },
      { name: 'Microwave',     avgKw: parseFloat(row.microwave)     || 0 },
      { name: 'Kitchen 12',    avgKw: parseFloat(row.kitchen12)     || 0 },
      { name: 'Kitchen 14',    avgKw: parseFloat(row.kitchen14)     || 0 },
      { name: 'Kitchen 38',    avgKw: parseFloat(row.kitchen38)     || 0 },
      { name: 'Garage Door',   avgKw: parseFloat(row.garage_door)   || 0 },
      { name: 'Living Room',   avgKw: parseFloat(row.living_room)   || 0 },
    ].sort((a, b) => b.avgKw - a.avgKw);

    res.json({ success: true, data: appliances });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dataset/weather
// Returns weather summary averages
// ─────────────────────────────────────────────────────────────────────────────
router.get('/weather', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ROUND(AVG(temperature)::numeric, 2)       AS "avgTemp",
        ROUND(AVG(humidity)::numeric, 4)          AS "avgHumidity",
        ROUND(AVG(wind_speed)::numeric, 2)        AS "avgWindSpeed",
        ROUND(AVG(cloud_cover)::numeric, 4)       AS "avgCloudCover",
        ROUND(AVG(dew_point)::numeric, 2)         AS "avgDewPoint",
        ROUND(AVG(pressure)::numeric, 2)          AS "avgPressure",
        ROUND(AVG(apparent_temp)::numeric, 2)     AS "avgApparentTemp",
        ROUND(AVG(precip_prob)::numeric, 4)       AS "avgPrecipProb"
      FROM energy_readings
      WHERE temperature IS NOT NULL
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
