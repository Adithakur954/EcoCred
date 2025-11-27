import pool from '../db.js';

// GET all devices
export const getAllDevices = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        d.id,
        d.device_name,
        d.device_type,
        d.device_id,
        d.status,
        d.location,
        d.user_id,
        d.last_active,
        d.created_at,
        d.updated_at,
        u.name as owner_name,
        u.email as owner_email
      FROM devices d
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
    `);
    
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error in getAllDevices:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching devices',
      error: error.message
    });
  }
};

// GET single device by ID
export const getDeviceById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await pool.query(`
      SELECT 
        d.*,
        u.name as owner_name,
        u.email as owner_email
      FROM devices d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.id = $1
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error in getDeviceById:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching device',
      error: error.message
    });
  }
};

// GET devices by status
export const getDevicesByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    
    const validStatuses = ['active', 'inactive', 'maintenance', 'offline'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    const { rows } = await pool.query(`
      SELECT 
        d.*,
        u.name as owner_name
      FROM devices d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.status = $1
      ORDER BY d.last_active DESC
    `, [status]);
    
    res.status(200).json({
      success: true,
      status: status,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error in getDevicesByStatus:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching devices by status',
      error: error.message
    });
  }
};

// GET device statistics/summary
export const getDeviceStats = async (req, res) => {
  try {
    const summaryResult = await pool.query(`
      SELECT 
        COUNT(*) as total_devices,
        COUNT(*) FILTER (WHERE status = 'active') as active_devices,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive_devices,
        COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance_devices,
        COUNT(*) FILTER (WHERE status = 'offline') as offline_devices,
        COUNT(DISTINCT device_type) as device_types,
        COUNT(DISTINCT user_id) as total_users
      FROM devices
    `);
    
    const typeStatsResult = await pool.query(`
      SELECT 
        device_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
        COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
        COUNT(*) FILTER (WHERE status = 'offline') as offline
      FROM devices
      GROUP BY device_type
      ORDER BY count DESC
    `);
    
    const statusDistribution = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM devices
      GROUP BY status
      ORDER BY count DESC
    `);
    
    res.status(200).json({
      success: true,
      data: {
        summary: summaryResult.rows[0],
        by_type: typeStatsResult.rows,
        status_distribution: statusDistribution.rows
      }
    });
  } catch (error) {
    console.error('Error in getDeviceStats:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching device statistics',
      error: error.message
    });
  }
};

// CREATE new device
export const createDevice = async (req, res) => {
  try {
    const { device_name, device_type, device_id, status, location, user_id } = req.body;
    
    // Check if device_id already exists
    const deviceExists = await pool.query(
      'SELECT * FROM devices WHERE device_id = $1',
      [device_id]
    );
    
    if (deviceExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Device with this ID already exists'
      });
    }
    
    // Check if user exists (if user_id provided)
    if (user_id) {
      const userExists = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [user_id]
      );
      
      if (userExists.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User not found'
        });
      }
    }
    
    const { rows } = await pool.query(
      `INSERT INTO devices (device_name, device_type, device_id, status, location, user_id, last_active)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [device_name, device_type, device_id, status || 'inactive', location, user_id]
    );
    
    res.status(201).json({
      success: true,
      message: 'Device created successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error in createDevice:', error.message);
    
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Device ID already exists'
      });
    }
    
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user_id'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating device',
      error: error.message
    });
  }
};

// UPDATE device
export const updateDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { device_name, device_type, status, location, user_id } = req.body;
    
    // Check if device exists
    const deviceExists = await pool.query(
      'SELECT * FROM devices WHERE id = $1',
      [id]
    );
    
    if (deviceExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (device_name) {
      updates.push(`device_name = $${paramCount}`);
      values.push(device_name);
      paramCount++;
    }
    
    if (device_type) {
      updates.push(`device_type = $${paramCount}`);
      values.push(device_type);
      paramCount++;
    }
    
    if (status) {
      updates.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
      
      // Update last_active if status is 'active'
      if (status === 'active') {
        updates.push(`last_active = NOW()`);
      }
    }
    
    if (location !== undefined) {
      updates.push(`location = $${paramCount}`);
      values.push(location);
      paramCount++;
    }
    
    if (user_id !== undefined) {
      // Check if user exists
      if (user_id !== null) {
        const userExists = await pool.query(
          'SELECT * FROM users WHERE id = $1',
          [user_id]
        );
        
        if (userExists.rows.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'User not found'
          });
        }
      }
      
      updates.push(`user_id = $${paramCount}`);
      values.push(user_id);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one field to update'
      });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const query = `
      UPDATE devices 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, values);
    
    res.status(200).json({
      success: true,
      message: 'Device updated successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error in updateDevice:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error updating device',
      error: error.message
    });
  }
};

// UPDATE device status only
export const updateDeviceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['active', 'inactive', 'maintenance', 'offline'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    const { rows } = await pool.query(
      `UPDATE devices 
       SET status = $1,
           last_active = CASE WHEN $1 = 'active' THEN NOW() ELSE last_active END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Device status updated to '${status}'`,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error in updateDeviceStatus:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error updating device status',
      error: error.message
    });
  }
};

// DELETE device
export const deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await pool.query(
      'DELETE FROM devices WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Device deleted successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error in deleteDevice:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error deleting device',
      error: error.message
    });
  }
};

// GET devices by user
export const getDevicesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const userExists = await pool.query(
      'SELECT id, name, email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const { rows } = await pool.query(`
      SELECT d.*
      FROM devices d
      WHERE d.user_id = $1
      ORDER BY d.created_at DESC
    `, [userId]);
    
    res.status(200).json({
      success: true,
      user: userExists.rows[0],
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error in getDevicesByUser:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching user devices',
      error: error.message
    });
  }
};

// SEARCH devices
export const searchDevices = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    const { rows } = await pool.query(`
      SELECT d.*, u.name as owner_name
      FROM devices d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.device_name ILIKE $1 
         OR d.device_type ILIKE $1 
         OR d.device_id ILIKE $1
         OR d.location ILIKE $1
      ORDER BY d.created_at DESC
    `, [`%${query}%`]);
    
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error in searchDevices:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error searching devices',
      error: error.message
    });
  }
};

// GET devices by type
export const getDevicesByType = async (req, res) => {
  try {
    const { type } = req.params;
    
    const { rows } = await pool.query(`
      SELECT d.*, u.name as owner_name
      FROM devices d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.device_type = $1
      ORDER BY d.created_at DESC
    `, [type]);
    
    res.status(200).json({
      success: true,
      device_type: type,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error in getDevicesByType:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching devices by type',
      error: error.message
    });
  }
};

// BULK update device status
export const bulkUpdateStatus = async (req, res) => {
  try {
    const { device_ids, status } = req.body;
    
    if (!device_ids || !Array.isArray(device_ids) || device_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of device IDs'
      });
    }
    
    const validStatuses = ['active', 'inactive', 'maintenance', 'offline'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    const placeholders = device_ids.map((_, index) => `$${index + 2}`).join(',');
    
    const { rows } = await pool.query(
      `UPDATE devices 
       SET status = $1,
           last_active = CASE WHEN $1 = 'active' THEN NOW() ELSE last_active END,
           updated_at = NOW()
       WHERE id IN (${placeholders})
       RETURNING *`,
      [status, ...device_ids]
    );
    
    res.status(200).json({
      success: true,
      message: `${rows.length} device(s) updated to '${status}'`,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error in bulkUpdateStatus:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error bulk updating device status',
      error: error.message
    });
  }
};

// GET recently active devices
export const getRecentlyActiveDevices = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const { rows } = await pool.query(`
      SELECT d.*, u.name as owner_name
      FROM devices d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.status = 'active'
      ORDER BY d.last_active DESC
      LIMIT $1
    `, [limit]);
    
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error in getRecentlyActiveDevices:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching recently active devices',
      error: error.message
    });
  }
};