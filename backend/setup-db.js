const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setup() {
  // Try to create the database
  const admin = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: process.env.PG_PASS || 'Algoflow',
    database: 'postgres',
  });

  try {
    await admin.connect();
    console.log('✓ Connected to PostgreSQL');
  } catch (err) {
    console.error('✗ Connection failed:', err.message);
    console.error('\nTry: node setup-db.js <your-postgres-password>');
    process.exit(1);
  }

  // Create database
  try {
    await admin.query('CREATE DATABASE tradeflow');
    console.log('✓ Database "tradeflow" created');
  } catch (err) {
    if (err.code === '42P04') {
      console.log('✓ Database "tradeflow" already exists');
    } else {
      console.error('✗ Failed to create database:', err.message);
      await admin.end();
      process.exit(1);
    }
  }
  await admin.end();

  // Run schema
  const db = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: process.env.PG_PASS || 'Algoflow',
    database: 'tradeflow',
  });

  await db.connect();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await db.query(schema);
    console.log('✓ Schema applied');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('✓ Tables already exist');
    } else {
      console.error('✗ Schema error:', err.message);
    }
  }
  await db.end();
  console.log('\n✅ Database ready. You can now run: npm run dev');
}

setup();
