import bcrypt from 'bcrypt';
import pool from './db.js';
import { awardEligibleBadges, ensureDemoSchema, seedStarterDataForUser } from './utils/demoSeed.js';

const demoUsers = [
  { name: 'Aditya Eco Home', email: 'aditya.demo@ecoguard.local', points: 180, streak: 12 },
  { name: 'Anshika Green Flat', email: 'anshika.demo@ecoguard.local', points: 135, streak: 9 },
  { name: 'Bhavya Smart Home', email: 'bhavya.demo@ecoguard.local', points: 95, streak: 6 },
  { name: 'Devyansh Saver Home', email: 'devyansh.demo@ecoguard.local', points: 70, streak: 4 }
];

const tips = [
  ['Peak Hour Shift', 'Run heavy appliances during off-peak hours to reduce peak load and improve your weekly trend.', 'electricity'],
  ['AC Setpoint Rule', 'Keep air conditioning near 24-26C and use fans for circulation to reduce compressor load.', 'electricity'],
  ['Standby Power Check', 'Switch off chargers, TVs, and set-top boxes from the plug when they are not in use.', 'electricity'],
  ['Short Shower Target', 'Keep showers under five minutes to reduce daily water use without changing your routine much.', 'water'],
  ['Leak Patrol', 'Check taps, flush tanks, and kitchen fittings weekly; small leaks can waste hundreds of liters.', 'water'],
  ['Full Load Washing', 'Run washing machines and dishwashers only with full loads to save both water and electricity.', 'general'],
  ['Weekly Goal', 'Compare this week with last week and set a small reduction goal instead of trying to change everything.', 'general'],
  ['Kitchen Reuse', 'Reuse vegetable-rinse water for plants when possible.', 'water'],
  ['Natural Light Window', 'Use daylight during morning study or work hours before switching on room lights.', 'electricity']
];

const badges = [
  ['Eco Starter', 'Logged your first resource usage.', null, 10],
  ['Water Saver', 'Reduced or tracked meaningful water usage.', null, 50],
  ['Energy Efficient', 'Built a consistent energy-saving habit.', null, 100],
  ['Planet Guardian', 'Earned 500 total EcoPoints.', null, 500],
  ['Seven Day Streak', 'Stayed active for a full week.', null, 75]
];

const createEnergyTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS energy_readings (
      id SERIAL PRIMARY KEY,
      time TIMESTAMP NOT NULL,
      use_kw DECIMAL(10,4),
      gen_kw DECIMAL(10,4),
      house_overall DECIMAL(10,4),
      dishwasher DECIMAL(10,4),
      furnace1 DECIMAL(10,4),
      furnace2 DECIMAL(10,4),
      home_office DECIMAL(10,4),
      fridge DECIMAL(10,4),
      wine_cellar DECIMAL(10,4),
      garage_door DECIMAL(10,4),
      kitchen12 DECIMAL(10,4),
      kitchen14 DECIMAL(10,4),
      kitchen38 DECIMAL(10,4),
      barn DECIMAL(10,4),
      well DECIMAL(10,4),
      microwave DECIMAL(10,4),
      living_room DECIMAL(10,4),
      solar DECIMAL(10,4),
      temperature DECIMAL(8,4),
      icon VARCHAR(50),
      humidity DECIMAL(6,4),
      visibility DECIMAL(8,4),
      summary VARCHAR(100),
      apparent_temp DECIMAL(8,4),
      pressure DECIMAL(10,4),
      wind_speed DECIMAL(8,4),
      cloud_cover DECIMAL(6,4),
      wind_bearing DECIMAL(8,4),
      precip_intensity DECIMAL(10,6),
      dew_point DECIMAL(8,4),
      precip_prob DECIMAL(6,4)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_energy_time ON energy_readings(time);`);
};

const seedTipsAndBadges = async () => {
  for (const [title, description, category] of tips) {
    await pool.query(
      `INSERT INTO eco_tips (title, description, category)
       SELECT $1::varchar, $2::text, $3::varchar
       WHERE NOT EXISTS (SELECT 1 FROM eco_tips WHERE title = $1)`,
      [title, description, category]
    );
  }

  for (const [name, description, iconUrl, pointsRequired] of badges) {
    await pool.query(
      `INSERT INTO gamification_badges (name, description, icon_url, points_required)
       SELECT $1::varchar, $2::text, $3::varchar, $4::int
       WHERE NOT EXISTS (SELECT 1 FROM gamification_badges WHERE name = $1)`,
      [name, description, iconUrl, pointsRequired]
    );
  }
};

const seedEnergyReadings = async () => {
  const count = await pool.query('SELECT COUNT(*)::int AS count FROM energy_readings');
  if (count.rows[0].count > 0) return;

  const now = new Date();
  for (let i = 0; i < 96; i++) {
    const time = new Date(now.getTime() - (95 - i) * 60 * 60 * 1000);
    const hour = time.getHours();
    const eveningPeak = hour >= 18 && hour <= 22 ? 0.55 : 0;
    const morningPeak = hour >= 7 && hour <= 10 ? 0.28 : 0;
    const solar = hour >= 9 && hour <= 16 ? Math.max(0.05, 0.55 - Math.abs(12 - hour) * 0.08) : 0.02;
    const use = 0.75 + eveningPeak + morningPeak + ((i % 5) * 0.05);
    const gen = solar * 0.85;

    await pool.query(
      `INSERT INTO energy_readings (
        time, use_kw, gen_kw, house_overall, dishwasher, furnace1, furnace2, home_office,
        fridge, wine_cellar, garage_door, kitchen12, kitchen14, kitchen38, barn, well,
        microwave, living_room, solar, temperature, icon, humidity, visibility, summary,
        apparent_temp, pressure, wind_speed, cloud_cover, wind_bearing, precip_intensity,
        dew_point, precip_prob
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
      )`,
      [
        time, use, gen, use * 0.55, 0.12 + (i % 3) * 0.02, 0.22 + eveningPeak * 0.25,
        0.18 + morningPeak * 0.2, 0.08 + (hour >= 10 && hour <= 18 ? 0.06 : 0),
        0.11, 0.05, 0.02, 0.04, 0.05, 0.03, 0.08, 0.03, 0.06, 0.07,
        solar, 24 + Math.sin(i / 8) * 4, 'partly-cloudy-day', 0.48 + (i % 10) / 100,
        9.5, 'Partly cloudy', 25 + Math.sin(i / 8) * 4, 1011 + (i % 6),
        2.5 + (i % 4) * 0.4, 0.35 + (i % 5) / 20, 120, 0.0003, 14 + Math.sin(i / 9) * 3, 0.12
      ]
    );
  }
};

const seedDemoUsers = async () => {
  const password = await bcrypt.hash('password123', 10);

  for (const demoUser of demoUsers) {
    const result = await pool.query(
      `INSERT INTO users (name, email, password, points, streak_days, last_active_date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         points = GREATEST(users.points, EXCLUDED.points),
         streak_days = GREATEST(users.streak_days, EXCLUDED.streak_days),
         last_active_date = CURRENT_DATE
       RETURNING id`,
      [demoUser.name, demoUser.email, password, demoUser.points, demoUser.streak]
    );

    const userId = result.rows[0].id;
    await seedStarterDataForUser(pool, userId);
    await pool.query(
      `UPDATE users SET points = GREATEST(points, $2), streak_days = GREATEST(streak_days, $3) WHERE id = $1`,
      [userId, demoUser.points, demoUser.streak]
    );
    await awardEligibleBadges(pool, userId);
  }
};

try {
  console.log('Seeding EcoGuard paper demo data...');
  await ensureDemoSchema(pool);
  await createEnergyTable();
  await seedTipsAndBadges();
  await seedEnergyReadings();
  await seedDemoUsers();
  console.log('EcoGuard paper demo data is ready.');
  console.log('Demo login: aditya.demo@ecoguard.local / password123');
} catch (error) {
  console.error('Demo seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
