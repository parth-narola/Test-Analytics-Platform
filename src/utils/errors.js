/**
 * Base class for custom application errors
 */
class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * ValidationError - Used for invalid request payloads (HTTP 400)
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, details);
  }
}

/**
 * UnauthorizedError - Used for authentication failures (HTTP 401)
 */
class UnauthorizedError extends AppError {
  constructor(message, details = null) {
    super(message, 401, details);
  }
}

/**
 * NotFoundError - Used when a resource is not found (HTTP 404)
 */
class NotFoundError extends AppError {
  constructor(message, details = null) {
    super(message, 404, details);
  }
}

/**
 * ConflictError - Used for duplicate resources or conflicts (HTTP 409)
 */
class ConflictError extends AppError {
  constructor(message, details = null) {
    super(message, 409, details);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError
};
