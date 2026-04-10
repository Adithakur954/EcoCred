import pool from './db.js';

const setupEnergyTable = async () => {
  console.log('🚀 Creating energy_readings table...');

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS energy_readings (
        id              SERIAL PRIMARY KEY,
        time            TIMESTAMP NOT NULL,
        use_kw          DECIMAL(10,4),
        gen_kw          DECIMAL(10,4),
        house_overall   DECIMAL(10,4),
        dishwasher      DECIMAL(10,4),
        furnace1        DECIMAL(10,4),
        furnace2        DECIMAL(10,4),
        home_office     DECIMAL(10,4),
        fridge          DECIMAL(10,4),
        wine_cellar     DECIMAL(10,4),
        garage_door     DECIMAL(10,4),
        kitchen12       DECIMAL(10,4),
        kitchen14       DECIMAL(10,4),
        kitchen38       DECIMAL(10,4),
        barn            DECIMAL(10,4),
        well            DECIMAL(10,4),
        microwave       DECIMAL(10,4),
        living_room     DECIMAL(10,4),
        solar           DECIMAL(10,4),
        temperature     DECIMAL(8,4),
        icon            VARCHAR(50),
        humidity        DECIMAL(6,4),
        visibility      DECIMAL(8,4),
        summary         VARCHAR(100),
        apparent_temp   DECIMAL(8,4),
        pressure        DECIMAL(10,4),
        wind_speed      DECIMAL(8,4),
        cloud_cover     DECIMAL(6,4),
        wind_bearing    DECIMAL(8,4),
        precip_intensity DECIMAL(10,6),
        dew_point       DECIMAL(8,4),
        precip_prob     DECIMAL(6,4)
      );
    `);

    // Index on time for fast range queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_energy_time ON energy_readings(time);
    `);

    console.log('✅ energy_readings table created successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
};

setupEnergyTable();
