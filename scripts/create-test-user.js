#!/usr/bin/env node

/**
 * Create Test User Script
 * Creates a test user for authentication testing
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001';

async function createTestUser() {
  console.log('🔧 Creating test user for authentication...');

  const testUsers = [
    {
      email: 'admin@test.com',
      password: 'Test123456!',
      firstName: 'Admin',
      lastName: 'Test',
      companyName: 'Test Company',
      role: 'admin'
    },
    {
      email: 'user@test.com', 
      password: 'Test123456!',
      firstName: 'User',
      lastName: 'Test',
      companyName: 'Test Company',
      role: 'user'
    }
  ];

  for (const userData of testUsers) {
    try {
      console.log(`Creating user: ${userData.email}`);
      
      const response = await axios.post(`${BASE_URL}/api/auth/register`, userData);
      
      if (response.data.success) {
        console.log(`✅ User ${userData.email} created successfully`);
      } else {
        console.log(`⚠️ User ${userData.email} response:`, response.data);
      }
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`⚠️ User ${userData.email} may already exist or validation failed`);
      } else {
        console.log(`❌ Failed to create user ${userData.email}:`, error.response?.data || error.message);
      }
    }
  }

  // Test login with first user
  try {
    console.log('\n🔐 Testing login with admin user...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: testUsers[0].email,
      password: testUsers[0].password
    });

    if (loginResponse.data.success) {
      console.log('✅ Test login successful!');
      console.log('Token:', loginResponse.data.data?.token?.substring(0, 20) + '...');
    } else {
      console.log('⚠️ Test login response:', loginResponse.data);
    }
  } catch (error) {
    console.log('❌ Test login failed:', error.response?.data || error.message);
  }
}

if (require.main === module) {
  createTestUser().catch(console.error);
}

module.exports = createTestUser;