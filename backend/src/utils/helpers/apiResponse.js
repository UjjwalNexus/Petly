// src/utils/helpers/apiResponse.js
class ApiResponse {
  constructor(success, message, data = null, meta = null) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.meta = meta;
    this.timestamp = new Date().toISOString();
  }

  static success(res, message, data = null, statusCode = 200, meta = null) {
    const response = new ApiResponse(true, message, data, meta);
    return res.status(statusCode).json(response);
  }

  static created(res, message, data = null, meta = null) {
    return ApiResponse.success(res, message, data, 201, meta);
  }

  static paginated(res, message, data, pagination, meta = null) {
    const response = {
      success: true,
      message,
      data: data.docs || data,
      meta: {
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          pages: pagination.pages
        },
        ...meta
      },
      timestamp: new Date().toISOString()
    };
    return res.status(200).json(response);
  }
}

module.exports = ApiResponse;