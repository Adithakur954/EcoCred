const starterDevices = [
  { name: 'Living Room AC', type: 'electricity', key: 'ac', status: 'active', location: 'Living Room' },
  { name: 'Kitchen Tap', type: 'water', key: 'tap', status: 'active', location: 'Kitchen' },
  { name: 'Bathroom Shower', type: 'water', key: 'shower', status: 'inactive', location: 'Bathroom' },
  { name: 'Refrigerator', type: 'electricity', key: 'fridge', status: 'active', location: 'Kitchen' }
];

const usagePattern = [
  { daysAgo: 6, electricity: 4.6, water: 145 },
  { daysAgo: 5, electricity: 4.1, water: 132 },
  { daysAgo: 4, electricity: 3.8, water: 126 },
  { daysAgo: 3, electricity: 4.9, water: 155 },
  { daysAgo: 2, electricity: 3.5, water: 118 },
  { daysAgo: 1, electricity: 3.2, water: 110 },
  { daysAgo: 0, electricity: 2.9, water: 96 }
];

export const ensureDemoSchema = async (pool) => {
  await pool.query(`ALTER TABLE gamification_badges ADD COLUMN IF NOT EXISTS icon_url VARCHAR(255);`);
  await pool.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_name VARCHAR(255);`);
  await pool.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_type VARCHAR(100);`);
  await pool.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);`);
  await pool.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS location VARCHAR(255);`);
  await pool.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT NOW();`);
  await pool.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`);
  await pool.query(`UPDATE devices SET device_name = COALESCE(device_name, name, 'Home Device') WHERE device_name IS NULL;`);
  await pool.query(`UPDATE devices SET device_type = COALESCE(device_type, type, 'appliance') WHERE device_type IS NULL;`);
  await pool.query(`UPDATE devices SET device_id = COALESCE(device_id, 'legacy-' || id::text) WHERE device_id IS NULL;`);
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'name'
      ) THEN
        ALTER TABLE devices ALTER COLUMN name DROP NOT NULL;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'type'
      ) THEN
        ALTER TABLE devices ALTER COLUMN type DROP NOT NULL;
      END IF;
    END $$;
  `);
  await pool.query(`ALTER TABLE devices ALTER COLUMN device_name SET NOT NULL;`);
  await pool.query(`ALTER TABLE devices ALTER COLUMN device_type SET NOT NULL;`);
  await pool.query(`ALTER TABLE devices ALTER COLUMN device_id SET NOT NULL;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS devices_device_id_unique ON devices(device_id);`);
};

export const seedStarterDataForUser = async (pool, userId) => {
  await ensureDemoSchema(pool);

  const deviceIds = {};

  for (const device of starterDevices) {
    const result = await pool.query(
      `INSERT INTO devices (device_name, device_type, device_id, status, location, user_id, last_active)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (device_id) DO UPDATE SET
         device_name = EXCLUDED.device_name,
         device_type = EXCLUDED.device_type,
         status = EXCLUDED.status,
         location = EXCLUDED.location,
         user_id = EXCLUDED.user_id,
         last_active = NOW(),
         updated_at = NOW()
       RETURNING id`,
      [device.name, device.type, `user-${userId}-${device.key}`, device.status, device.location, userId]
    );
    deviceIds[device.key] = result.rows[0].id;
  }

  const existing = await pool.query('SELECT COUNT(*)::int AS count FROM usage_events WHERE user_id = $1', [userId]);
  if (existing.rows[0].count === 0) {
    for (const item of usagePattern) {
      const eventTime = new Date();
      eventTime.setDate(eventTime.getDate() - item.daysAgo);

      await pool.query(
        `INSERT INTO usage_events (user_id, device_id, resource_type, amount, timestamp)
         VALUES ($1, $2, 'electricity', $3, $4)`,
        [userId, deviceIds.ac, item.electricity, eventTime]
      );

      await pool.query(
        `INSERT INTO usage_events (user_id, device_id, resource_type, amount, timestamp)
         VALUES ($1, $2, 'water', $3, $4)`,
        [userId, deviceIds.tap, item.water, eventTime]
      );
    }
  }

  await pool.query(
    `UPDATE users
     SET points = GREATEST(points, 85),
         streak_days = GREATEST(streak_days, 7),
         last_active_date = CURRENT_DATE
     WHERE id = $1`,
    [userId]
  );

  await awardEligibleBadges(pool, userId);
};

export const awardEligibleBadges = async (pool, userId) => {
  await pool.query(`
    INSERT INTO user_badges (user_id, badge_id)
    SELECT $1, id
    FROM gamification_badges
    WHERE points_required <= (SELECT points FROM users WHERE id = $1)
    ON CONFLICT (user_id, badge_id) DO NOTHING
  `, [userId]);
};
