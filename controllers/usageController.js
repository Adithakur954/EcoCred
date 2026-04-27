import pool from '../db.js';
import { awardEligibleBadges } from '../utils/demoSeed.js';

// POST /api/usage
// Log an event for electricity or water consumption
export const logUsageEvent = async (req, res) => {
    try {
        const { user_id, device_id, resource_type, amount, timestamp } = req.body;

        // Validate inputs
        if (!user_id || !resource_type || amount === undefined) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        if (resource_type !== 'electricity' && resource_type !== 'water') {
            return res.status(400).json({ success: false, message: 'Resource type must be electricity or water' });
        }

        const eventTime = timestamp ? new Date(timestamp) : new Date();

        const { rows } = await pool.query(
            `INSERT INTO usage_events (user_id, device_id, resource_type, amount, timestamp)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [user_id, device_id || null, resource_type, amount, eventTime]
        );

        const userStatus = await pool.query(
            'SELECT last_active_date FROM users WHERE id = $1',
            [user_id]
        );
        const lastActiveDate = userStatus.rows[0]?.last_active_date
            ? new Date(userStatus.rows[0].last_active_date).toISOString().slice(0, 10)
            : null;
        const today = new Date().toISOString().slice(0, 10);

        await pool.query(
            `UPDATE users 
       SET points = points + 5,
           streak_days = CASE
             WHEN last_active_date IS NULL THEN 1
             WHEN last_active_date < CURRENT_DATE THEN streak_days + 1
             ELSE streak_days
           END,
           last_active_date = CURRENT_DATE
       WHERE id = $1`,
            [user_id]
        );
        await awardEligibleBadges(pool, user_id);

        res.status(201).json({
            success: true,
            message: `Usage logged successfully. Earned 5 EcoPoints${lastActiveDate !== today ? ' and continued your streak' : ''}!`,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error in logUsageEvent:', error.message);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// GET /api/usage/summary/:userId
// Get interpretable data aggregation for trend visualizations
export const getUsageSummary = async (req, res) => {
    try {
        const { userId } = req.params;
        const { period } = req.query; // 'daily', 'weekly', 'monthly' (default to daily for last 7 days)

        // Ensure user exists
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Default: aggregates by date for the last 7 days
        const { rows } = await pool.query(
            `SELECT resource_type, DATE(timestamp) as usage_date, SUM(amount) as total_amount
       FROM usage_events
       WHERE user_id = $1 AND timestamp >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY resource_type, usage_date
       ORDER BY usage_date DESC`,
            [userId]
        );

        // Provide trend analysis comparison context
        // E.g., compare total this week vs last week
        const currentWeekResult = await pool.query(
            `SELECT resource_type, SUM(amount) as total 
       FROM usage_events 
       WHERE user_id = $1 AND timestamp >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY resource_type`,
            [userId]
        );

        const lastWeekResult = await pool.query(
            `SELECT resource_type, SUM(amount) as total
       FROM usage_events
       WHERE user_id = $1
         AND timestamp >= CURRENT_DATE - INTERVAL '14 days'
         AND timestamp < CURRENT_DATE - INTERVAL '7 days'
       GROUP BY resource_type`,
            [userId]
        );

        const recommendations = buildRecommendations(currentWeekResult.rows, lastWeekResult.rows);

        res.status(200).json({
            success: true,
            data: {
                trends: rows,
                currentWeek: currentWeekResult.rows,
                lastWeek: lastWeekResult.rows,
                recommendations
            }
        });
    } catch (error) {
        console.error('Error in getUsageSummary:', error.message);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

const getTotal = (rows, type) => {
    const row = rows.find(item => item.resource_type === type);
    return row ? parseFloat(row.total) : 0;
};

const buildRecommendations = (currentWeek, lastWeek) => {
    const recommendations = [];
    const currentElectricity = getTotal(currentWeek, 'electricity');
    const previousElectricity = getTotal(lastWeek, 'electricity');
    const currentWater = getTotal(currentWeek, 'water');
    const previousWater = getTotal(lastWeek, 'water');

    if (previousElectricity > 0 && currentElectricity > previousElectricity) {
        recommendations.push({
            type: 'electricity',
            title: 'Electricity rose this week',
            message: 'Try shifting heavy appliance use away from evening peak hours and unplug standby devices.'
        });
    } else {
        recommendations.push({
            type: 'electricity',
            title: 'Electricity trend is under control',
            message: 'Keep using natural light and continue tracking high-load appliances.'
        });
    }

    if (previousWater > 0 && currentWater > previousWater) {
        recommendations.push({
            type: 'water',
            title: 'Water usage increased',
            message: 'Check taps and shower duration; small leaks can create a large weekly jump.'
        });
    } else {
        recommendations.push({
            type: 'water',
            title: 'Water saving habit is building',
            message: 'Keep logging usage and reuse rinse water for plants when possible.'
        });
    }

    return recommendations;
};
