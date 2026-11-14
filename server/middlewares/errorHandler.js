export const sendSuccess = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
};

export const sendError = (
  res,
  statusCode = 400,
  code = 'BAD_REQUEST',
  message = 'An error occurred',
  details = null
) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
};

export const errorHandler = (err, _req, res, _next) => {
  console.error('[CHRONOS ERROR]', err.message);
  const statusCode = err.statusCode || 500;
  return sendError(
    res,
    statusCode,
    err.code || 'INTERNAL_SERVER_ERROR',
    err.message || 'Unexpected server error',
    null
  );
};

