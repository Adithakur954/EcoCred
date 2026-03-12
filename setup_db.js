import pool from './db.js';

const setupDatabase = async () => {
  console.log('Starting EcoGuard database setup...');

  try {
    // 1. Alter Users Table
    console.log('Updating users table with gamification columns...');
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS points INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS streak_days INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_active_date DATE;
    `);

    // 2. Create Usage Events Table
    console.log('Creating usage_events table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usage_events (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        device_id INT REFERENCES devices(id) ON DELETE SET NULL,
        resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('electricity', 'water')),
        amount DECIMAL(10, 2) NOT NULL, -- kWh for electricity, Liters for water
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3. Create Eco-tips Table
    console.log('Creating eco_tips table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS eco_tips (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(50) NOT NULL CHECK (category IN ('electricity', 'water', 'general'))
      );
    `);

    // Insert some initial eco-tips if none exist
    const tipsResult = await pool.query('SELECT count(*) FROM eco_tips');
    if (parseInt(tipsResult.rows[0].count) === 0) {
      console.log('Inserting default eco-tips...');
      await pool.query(`
        INSERT INTO eco_tips (title, description, category) VALUES 
        ('Unplug Appliances', 'Vampire power can account for up to 10% of your energy bill. Unplug devices when not in use.', 'electricity'),
        ('Fix Leaks', 'A dripping faucet can waste up to 3,000 gallons of water a year. Fix leaks promptly.', 'water'),
        ('Use Natural Light', 'Open your curtains during the day and save on lighting costs.', 'electricity'),
        ('Shorter Showers', 'Cutting your shower time by just 2 minutes saves up to 5 gallons of water.', 'water'),
        ('Smart Thermostat', 'Setting your thermostat back 7-10 degrees for 8 hours a day can save up to 10% a year on heating and cooling.', 'electricity')
      `);
    }

    // 4. Create Badges Table
    console.log('Creating gamification_badges table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gamification_badges (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        icon_url VARCHAR(255),
        points_required INT DEFAULT 0
      );
    `);

    // Insert default badges
    const badgesResult = await pool.query('SELECT count(*) FROM gamification_badges');
    if (parseInt(badgesResult.rows[0].count) === 0) {
      console.log('Inserting default badges...');
      await pool.query(`
        INSERT INTO gamification_badges (name, description, points_required) VALUES 
        ('Eco Starter', 'Logged your first resource usage.', 10),
        ('Water Saver', 'Saved 100 liters of water overall.', 50),
        ('Energy Efficient', 'Kept electricity under 5 kWh for 3 days.', 100),
        ('Planet Guardian', 'Earned 500 total EcoPoints.', 500)
      `);
    }

    // 5. Create User Badges Table
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

    console.log('✅ Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
};

setupDatabase();
