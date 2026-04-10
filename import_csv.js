import fs from 'fs';
import { parse } from 'csv-parse';
import pool from './db.js';

// ── CONFIG ──────────────────────────────────────────────────────────────────
const CSV_PATH = process.argv[2] || 'D:\\Downloads\\archive\\HomeC.csv';
const BATCH_SIZE = 500; // rows per INSERT batch

const safe = (v) => {
  if (v === undefined || v === null || v === '' || v === 'NaN' || isNaN(Number(v))) return null;
  return parseFloat(v);
};

const safeStr = (v) => (v === undefined || v === '' ? null : String(v).trim().substring(0, 100));

const parseTime = (v) => {
  if (!v || v === 'time') return null;      // skip header re-rows
  const n = parseFloat(v);
  if (!isNaN(n) && n > 1_000_000_000) {
    return new Date(n * 1000).toISOString(); // Unix seconds → ISO string
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const rowToValues = (row) => [
  parseTime(row['time']),
  safe(row['use [kW]']),
  safe(row['gen [kW]']),
  safe(row['House overall [kW]']),
  safe(row['Dishwasher [kW]']),
  safe(row['Furnace 1 [kW]']),
  safe(row['Furnace 2 [kW]']),
  safe(row['Home office [kW]']),
  safe(row['Fridge [kW]']),
  safe(row['Wine cellar [kW]']),
  safe(row['Garage door [kW]']),
  safe(row['Kitchen 12 [kW]']),
  safe(row['Kitchen 14 [kW]']),
  safe(row['Kitchen 38 [kW]']),
  safe(row['Barn [kW]']),
  safe(row['Well [kW]']),
  safe(row['Microwave [kW]']),
  safe(row['Living room [kW]']),
  safe(row['Solar [kW]']),
  safe(row['temperature']),
  safeStr(row['icon']),
  safe(row['humidity']),
  safe(row['visibility']),
  safeStr(row['summary']),
  safe(row['apparentTemperature']),
  safe(row['pressure']),
  safe(row['windSpeed']),
  safe(row['cloudCover']),
  safe(row['windBearing']),
  safe(row['precipIntensity']),
  safe(row['dewPoint']),
  safe(row['precipProbability']),
];

const INSERT_SQL = `
  INSERT INTO energy_readings (
    time, use_kw, gen_kw, house_overall, dishwasher, furnace1, furnace2,
    home_office, fridge, wine_cellar, garage_door, kitchen12, kitchen14,
    kitchen38, barn, well, microwave, living_room, solar,
    temperature, icon, humidity, visibility, summary, apparent_temp,
    pressure, wind_speed, cloud_cover, wind_bearing, precip_intensity,
    dew_point, precip_prob
  ) VALUES
`;

const insertBatch = async (batch) => {
  if (batch.length === 0) return;
  const placeholders = [];
  const values = [];
  let idx = 1;

  for (const row of batch) {
    const vals = rowToValues(row);
    const ph = vals.map(() => `$${idx++}`).join(', ');
    placeholders.push(`(${ph})`);
    values.push(...vals);
  }

  await pool.query(INSERT_SQL + placeholders.join(',\n') + ' ON CONFLICT DO NOTHING', values);
};

const main = async () => {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ File not found: ${CSV_PATH}`);
    console.error('Usage: node import_csv.js <path-to-csv>');
    process.exit(1);
  }

  console.log(`\n📂 Reading: ${CSV_PATH}`);
  console.log('🚀 Starting import...\n');

  let total = 0;
  let batch = [];
  let batchNum = 0;
  let errors = 0;

  const parser = fs.createReadStream(CSV_PATH).pipe(
    parse({
      columns: true,        // use first row as column names
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    })
  );

  for await (const row of parser) {
    const t = parseTime(row['time']);
    if (!t) continue;          // skip rows with invalid/missing time
    batch.push(row);
    total++;

    if (batch.length >= BATCH_SIZE) {
      batchNum++;
      process.stdout.write(`  ⬆ Batch ${batchNum}: inserting rows ${total - batch.length + 1}–${total}...`);
      try {
        await insertBatch(batch);
        console.log(' ✅');
      } catch (e) {
        console.log(` ❌ ${e.message}`);
        errors++;
      }
      batch = [];
    }
  }

  // Final partial batch
  if (batch.length > 0) {
    batchNum++;
    process.stdout.write(`  ⬆ Batch ${batchNum}: inserting rows ${total - batch.length + 1}–${total}...`);
    try {
      await insertBatch(batch);
      console.log(' ✅');
    } catch (e) {
      console.log(` ❌ ${e.message}`);
      errors++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Import complete!`);
  console.log(`   Rows processed : ${total.toLocaleString()}`);
  console.log(`   Batches        : ${batchNum}`);
  console.log(`   Errors         : ${errors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await pool.end();
  process.exit(errors > 0 ? 1 : 0);
};

main().catch((e) => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
