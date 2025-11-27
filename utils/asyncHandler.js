// asyncHandler.js
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};


import { asyncHandler } from './asyncHandler.js';

app.get('/api/users', asyncHandler(async (req, res) => {
  const users = await getAllUsers();
  res.json({ success: true, data: users });
}));

// Error middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message
  });
});