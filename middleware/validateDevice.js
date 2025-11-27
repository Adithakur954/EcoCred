// Validate device creation
export const validateCreateDevice = (req, res, next) => {
  const { device_name, device_type, device_id } = req.body;
  
  if (!device_name || !device_type || !device_id) {
    return res.status(400).json({
      success: false,
      message: 'Please provide device_name, device_type, and device_id'
    });
  }
  
  if (device_name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Device name must be at least 2 characters'
    });
  }
  
  if (device_id.trim().length < 3) {
    return res.status(400).json({
      success: false,
      message: 'Device ID must be at least 3 characters'
    });
  }
  
  next();
};

// Validate device update
export const validateUpdateDevice = (req, res, next) => {
  const { device_name, device_type, status, location, user_id } = req.body;
  
  if (!device_name && !device_type && !status && !location && user_id === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Please provide at least one field to update'
    });
  }
  
  if (status) {
    const validStatuses = ['active', 'inactive', 'maintenance', 'offline'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
  }
  
  next();
};

// Validate status update
export const validateStatusUpdate = (req, res, next) => {
  const { status } = req.body;
  
  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Status is required'
    });
  }
  
  const validStatuses = ['active', 'inactive', 'maintenance', 'offline'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }
  
  next();
};

// Validate ID parameter
export const validateId = (req, res, next) => {
  const { id } = req.params;
  
  if (!id || isNaN(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid device ID'
    });
  }
  
  next();
};