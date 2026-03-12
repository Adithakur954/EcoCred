import pool from '../db.js';

// GET /api/gamification/leaderboard
export const getLeaderboard = async (req, res) => {
    try {
        const { rows } = await pool.query(`
      SELECT id, name, points, streak_days 
      FROM users 
      ORDER BY points DESC, streak_days DESC 
      LIMIT 10
    `);

        res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// GET /api/gamification/status/:userId
export const getUserGamificationStatus = async (req, res) => {
    try {
        const { userId } = req.params;

        const userResult = await pool.query(
            'SELECT id, name, points, streak_days, last_active_date FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const badgeResult = await pool.query(`
      SELECT gb.id, gb.name, gb.description, gb.icon_url, ub.earned_at
      FROM user_badges ub
      JOIN gamification_badges gb ON ub.badge_id = gb.id
      WHERE ub.user_id = $1
      ORDER BY ub.earned_at DESC
    `, [userId]);

        res.status(200).json({
            success: true,
            data: {
                user: userResult.rows[0],
                badges: badgeResult.rows
            }
        });
    } catch (error) {
        console.error('Error fetching gamification status:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
