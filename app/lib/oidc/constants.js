module.exports.ERROR_REASONS = {
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',
  DISCOVERY_FAILED: 'DISCOVERY_FAILED',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_TIMEOUT: 'LOGIN_TIMEOUT',
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  REFRESH_FAILED: 'REFRESH_FAILED'
};

module.exports.DEFAULT_SCOPE = 'openid profile offline_access';

// 127.0.0.1 avoids environments where 'localhost' resolves to an IPv6-only
// loopback address that enterprise proxies/VPNs cannot reach (RFC 8252 §7.3)
module.exports.LOOPBACK_HOST = '127.0.0.1';

module.exports.CALLBACK_PATH = '/callback';

module.exports.LOGIN_TIMEOUT = 1000 * 60 * 5;

// renew slightly ahead of real expiry to avoid races with in-flight requests
module.exports.EXPIRY_SKEW = 60;
