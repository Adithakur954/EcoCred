// Validate user creation
export const validateCreateUser = (req, res, next) => {
  const { name, email, password } = req.body;
  
  // Check if all fields are provided
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, email, and password'
    });
  }
  
  // Validate name
  if (name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Name must be at least 2 characters long'
    });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address'
    });
  }
  
  // Validate password
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long'
    });
  }
  
  next();
};

// Validate user update
export const validateUpdateUser = (req, res, next) => {
  const { name, email } = req.body;
  
  if (!name && !email) {
    return res.status(400).json({
      success: false,
      message: 'Please provide at least name or email to update'
    });
  }
  
  if (name && name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Name must be at least 2 characters long'
    });
  }
  
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
  }
  
  next();
};

// Validate ID parameter
export const validateId = (req, res, next) => {
  const { id } = req.params;
  
  if (!id || isNaN(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user ID'
    });
  }
  
  next();
};