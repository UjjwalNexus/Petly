// services/ai.service.js
const axios = require('axios');
const logger = require('../config/logger');

class AIService {
  constructor() {
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001/api/v1';
    this.apiKey = process.env.AI_SERVICE_API_KEY;
    this.timeout = 10000; // 10 seconds
    
    this.client = axios.create({
      baseURL: this.aiServiceUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    });
  }

  async moderateContent(text) {
    try {
      const response = await this.client.post('/moderate', { text });
      return response.data;
    } catch (error) {
      logger.error(`AI moderation failed: ${error.message}`);
      // Return safe default
      return {
        toxicity_score: 0.0,
        is_safe: true,
        flagged: false,
        error: 'Moderation service unavailable'
      };
    }
  }

  async analyzeSentiment(text) {
    try {
      const response = await this.client.post('/analyze-sentiment', { text });
      return response.data;
    } catch (error) {
      logger.error(`AI sentiment analysis failed: ${error.message}`);
      return {
        sentiment: 'neutral',
        confidence: 0.0,
        error: 'Sentiment analysis service unavailable'
      };
    }
  }

  async getRecommendations(userId, interests = []) {
    try {
      // Get community topics from database
      const Community = require('../models/Community.model');
      const communities = await Community.find().select('tags name').limit(50);
      
      const communityTopics = [...new Set(
        communities.flatMap(c => c.tags)
      )].slice(0, 20);

      const response = await this.client.post('/recommend', {
        user_interests: interests,
        community_topics: communityTopics
      });

      // Map recommendations to actual communities
      const recommendations = await Promise.all(
        response.data.recommendations.map(async (rec) => {
          const community = await Community.findOne(
            { name: { $regex: new RegExp(rec.community_name, 'i') } }
          ).select('name slug description avatar memberCount');
          
          return {
            ...rec,
            community: community ? community.toJSON() : null
          };
        })
      );

      return {
        ...response.data,
        recommendations: recommendations.filter(r => r.community)
      };
    } catch (error) {
      logger.error(`AI recommendations failed: ${error.message}`);
      return { recommendations: [], explanation: 'Unable to generate recommendations' };
    }
  }

  async batchModerate(texts) {
    try {
      const queryParams = texts.map(t => `texts=${encodeURIComponent(t)}`).join('&');
      const response = await this.client.post(`/batch-moderate?${queryParams}`);
      return response.data;
    } catch (error) {
      logger.error(`AI batch moderation failed: ${error.message}`);
      return {
        results: texts.map(text => ({
          text,
          error: 'Moderation service unavailable',
          status: 'failed'
        })),
        total: texts.length,
        successful: 0
      };
    }
  }

  async summarizeContent(text, maxLength = 200) {
    try {
      const response = await this.client.post('/summarize', {
        text,
        max_length: maxLength
      });
      return response.data;
    } catch (error) {
      logger.error(`AI summarization failed: ${error.message}`);
      return {
        summary: text.substring(0, maxLength) + '...',
        key_points: [],
        length: Math.min(text.length, maxLength),
        error: 'Summarization service unavailable'
      };
    }
  }
}

module.exports = new AIService();