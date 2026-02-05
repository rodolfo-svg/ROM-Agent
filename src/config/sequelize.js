/**
 * Sequelize Configuration
 *
 * Creates and exports a configured Sequelize instance for ORM operations
 */

import { Sequelize } from 'sequelize';
import logger from '../../lib/logger.js';

let sequelizeInstance = null;

/**
 * Initialize Sequelize with DATABASE_URL or individual env variables
 */
export function initSequelize() {
  if (sequelizeInstance) {
    return sequelizeInstance;
  }

  console.log('🔍 [Sequelize] Initializing ORM...');

  try {
    const config = {
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development'
        ? (msg) => logger.debug(msg)
        : false,
      pool: {
        max: parseInt(process.env.POSTGRES_POOL_SIZE) || 20,
        min: parseInt(process.env.POSTGRES_POOL_MIN) || 2,
        acquire: 30000,
        idle: 10000
      },
      dialectOptions: {}
    };

    // Add SSL in production
    if (process.env.NODE_ENV === 'production') {
      config.dialectOptions.ssl = {
        require: true,
        rejectUnauthorized: false
      };
    }

    // Use DATABASE_URL or individual variables
    if (process.env.DATABASE_URL) {
      console.log('🔍 [Sequelize] Using DATABASE_URL');
      sequelizeInstance = new Sequelize(process.env.DATABASE_URL, config);
    } else {
      console.log('🔍 [Sequelize] Using individual connection parameters');
      sequelizeInstance = new Sequelize({
        database: process.env.POSTGRES_DB || 'rom_agent',
        username: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD,
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT) || 5432,
        ...config
      });
    }

    console.log('✅ [Sequelize] ORM initialized successfully');
    logger.info('Sequelize ORM initialized');

    return sequelizeInstance;
  } catch (error) {
    console.error('❌ [Sequelize] Failed to initialize:', error.message);
    logger.error('Sequelize initialization failed', { error: error.message });
    throw error;
  }
}

/**
 * Get Sequelize instance (lazy initialization)
 */
export function getSequelize() {
  if (!sequelizeInstance) {
    return initSequelize();
  }
  return sequelizeInstance;
}

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    const sequelize = getSequelize();
    await sequelize.authenticate();
    console.log('✅ [Sequelize] Connection authenticated successfully');
    return true;
  } catch (error) {
    console.error('❌ [Sequelize] Connection test failed:', error.message);
    return false;
  }
}

/**
 * Close Sequelize connection
 */
export async function closeSequelize() {
  if (sequelizeInstance) {
    await sequelizeInstance.close();
    console.log('✅ [Sequelize] Connection closed');
    sequelizeInstance = null;
  }
}

// Export default instance (auto-initialized)
export default getSequelize();
