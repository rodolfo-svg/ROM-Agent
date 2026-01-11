/**
 * ROM Agent - AWS Credential Validator
 * Validates AWS credentials before Bedrock operations
 *
 * @module aws-credential-validator
 * @version 1.0.0
 */

/**
 * Required AWS environment variables for Bedrock access
 */
const REQUIRED_AWS_CREDENTIALS = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION'
];

/**
 * Optional AWS environment variables
 */
const OPTIONAL_AWS_CREDENTIALS = [
  'AWS_SESSION_TOKEN',  // For temporary credentials
  'AWS_PROFILE'         // For named profiles
];

/**
 * Validates that all required AWS credentials are configured
 *
 * @throws {Error} If any required credential is missing
 * @returns {boolean} True if all credentials are valid
 */
export function validateAWSCredentials() {
  const missing = REQUIRED_AWS_CREDENTIALS.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing AWS credentials: ${missing.join(', ')}`);
  }

  return true;
}

/**
 * Gets the current AWS credential status
 *
 * @returns {Object} Credential status object
 */
export function getCredentialStatus() {
  const status = {
    configured: true,
    required: {},
    optional: {},
    region: process.env.AWS_REGION || 'not-set'
  };

  // Check required credentials
  for (const key of REQUIRED_AWS_CREDENTIALS) {
    const value = process.env[key];
    status.required[key] = {
      present: !!value,
      // Show only first 4 chars for security
      preview: value ? `${value.substring(0, 4)}...` : null
    };
    if (!value) {
      status.configured = false;
    }
  }

  // Check optional credentials
  for (const key of OPTIONAL_AWS_CREDENTIALS) {
    const value = process.env[key];
    status.optional[key] = {
      present: !!value,
      preview: value ? `${value.substring(0, 4)}...` : null
    };
  }

  return status;
}

/**
 * Validates credentials and returns detailed error message
 *
 * @returns {Object} Validation result with success flag and details
 */
export function validateWithDetails() {
  const result = {
    success: true,
    errors: [],
    warnings: [],
    region: process.env.AWS_REGION || 'us-west-2'
  };

  // Check required credentials
  for (const key of REQUIRED_AWS_CREDENTIALS) {
    if (!process.env[key]) {
      result.success = false;
      result.errors.push(`${key} is not set`);
    }
  }

  // Check AWS_REGION specifically for Bedrock
  if (process.env.AWS_REGION) {
    const validBedrockRegions = [
      'us-east-1',
      'us-west-2',
      'eu-west-1',
      'eu-west-2',
      'eu-west-3',
      'ap-northeast-1',
      'ap-southeast-1',
      'ap-southeast-2'
    ];

    if (!validBedrockRegions.includes(process.env.AWS_REGION)) {
      result.warnings.push(
        `AWS_REGION '${process.env.AWS_REGION}' may not support all Bedrock models. ` +
        `Recommended regions: ${validBedrockRegions.join(', ')}`
      );
    }
  }

  // Check for session token with access keys (temporary credentials)
  if (process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_ACCESS_KEY_ID.startsWith('ASIA') &&
      !process.env.AWS_SESSION_TOKEN) {
    result.warnings.push(
      'AWS_ACCESS_KEY_ID appears to be temporary credentials but AWS_SESSION_TOKEN is not set'
    );
  }

  return result;
}

/**
 * Validates credentials silently (no throw, returns boolean)
 *
 * @returns {boolean} True if credentials are valid
 */
export function isConfigured() {
  return REQUIRED_AWS_CREDENTIALS.every(key => !!process.env[key]);
}

/**
 * Exports
 */
export default {
  validateAWSCredentials,
  getCredentialStatus,
  validateWithDetails,
  isConfigured,
  REQUIRED_AWS_CREDENTIALS,
  OPTIONAL_AWS_CREDENTIALS
};
