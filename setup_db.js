import pool from './db.js';

const setupDatabase = async () => {
  console.log('🚀 Starting EcoCred complete database setup...');

  try {
    // 1. Create Users Table
    console.log('Creating users table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        points INT DEFAULT 0,
        streak_days INT DEFAULT 0,
        last_active_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Create Devices Table
    console.log('Creating devices table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'inactive',
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3. Create Usage Events Table
    console.log('Creating usage_events table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usage_events (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        device_id INT REFERENCES devices(id) ON DELETE SET NULL,
        resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('electricity', 'water')),
        amount DECIMAL(10, 2) NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);

    // 4. Create Eco-tips Table
    console.log('Creating eco_tips table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS eco_tips (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(50) NOT NULL CHECK (category IN ('electricity', 'water', 'general'))
      );
    `);

    // 5. Insert default eco-tips
    const tipsCount = await pool.query('SELECT count(*) FROM eco_tips');
    if (parseInt(tipsCount.rows[0].count) === 0) {
      console.log('Inserting default eco-tips...');
      await pool.query(`
        INSERT INTO eco_tips (title, description, category) VALUES 
        ('Unplug Appliances', 'Vampire power can account for up to 10% of your energy bill.', 'electricity'),
        ('Fix Leaks', 'A dripping faucet can waste thousands of gallons of water a year.', 'water'),
        ('Use Natural Light', 'Open curtains during the day to save on lighting.', 'electricity'),
        ('Shorter Showers', 'Save up to 5 gallons per minute by reducing shower time.', 'water'),
        ('Smart Thermostat', 'Save up to 10% a year on heating and cooling.', 'electricity')
      `);
    }

    // 6. Create Badges Table
    console.log('Creating gamification_badges table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gamification_badges (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        points_required INT DEFAULT 0
      );
    `);

    // 7. Insert default badges
    const badgesCount = await pool.query('SELECT count(*) FROM gamification_badges');
    if (parseInt(badgesCount.rows[0].count) === 0) {
      console.log('Inserting default badges...');
      await pool.query(`
        INSERT INTO gamification_badges (name, description, points_required) VALUES 
        ('Eco Starter', 'Logged your first resource usage.', 10),
        ('Water Saver', 'Saved 100 liters of water overall.', 50),
        ('Energy Efficient', 'Kept electricity low for 3 days.', 100),
        ('Planet Guardian', 'Earned 500 total EcoPoints.', 500)
      `);
    }

    // 8. Create User Badges Table
    console.log('Creating user_badges table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        badge_id INT REFERENCES gamification_badges(id) ON DELETE CASCADE,
        earned_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, badge_id)
      );
    `);

    console.log('✅ EcoCred Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
};

setupDatabase();
