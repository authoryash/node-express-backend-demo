exports.Exception = function (res, status, message, data = "") {
  return res.status(status).json({
    status,
    Message: message,
    errors: data,
  });
};

exports.Success = function (res, status, message, data = "") {
  return res.status(status).json({
    status,
    Message: message,
    data,
    Success: true,
  });
};

exports.loginFailed = function (res, status, message, success) {
  return res.status(status).json({
    access_token: null,
    token_type: null,
    expires_in: 0,
    Success: success,
    Message: message,
  });
};

exports.loginSuccess = function (res, status, message, success, access_token) {
  return res.status(status).json({
    Message: message,
    Success: success,
    access_token,
    expires_in: 86400,
    token_type: "bearer",
  });
};
