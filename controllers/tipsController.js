import pool from '../db.js';

// GET /api/tips
export const getEcoTips = async (req, res) => {
    try {
        const { category } = req.query; // 'electricity', 'water', 'general'

        let query = 'SELECT * FROM eco_tips';
        let values = [];

        if (category) {
            query += ' WHERE category = $1';
            values.push(category);
        }

        query += ' ORDER BY RANDOM() LIMIT 5'; // Give random 5 tips to keep it engaging

        const { rows } = await pool.query(query, values);

        res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching tips:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
