// src/config/database.js
const mongoose = require('mongoose');
const logger = require('./logger');

class Database {
  constructor() {
    this.uri = process.env.MONGODB_URI;
    this.options = {
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 10,
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 5000,
      socketTimeoutMS: 45000,
    };
    
    this.connection = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) {
      return this.connection;
    }

    try {
      mongoose.set('strictQuery', true);
      
      this.connection = await mongoose.connect(this.uri, this.options);
      this.isConnected = true;
      
      logger.info('MongoDB connected successfully');
      
      // Connection event listeners
      mongoose.connection.on('connected', () => {
        logger.info('Mongoose connected to DB');
      });

      mongoose.connection.on('error', (err) => {
        logger.error('Mongoose connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('Mongoose disconnected from DB');
        this.isConnected = false;
      });

      return this.connection;
    } catch (error) {
      logger.error('MongoDB connection error:', error);
      process.exit(1);
    }
  }

  async disconnect() {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB disconnected');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnection() {
    return mongoose.connection;
  }

  async healthCheck() {
    try {
      await mongoose.connection.db.admin().ping();
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date() };
    }
  }
}

module.exports = new Database();