const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

const fetch = global.fetch || require('node-fetch');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const PLUGGY_BASE = 'https://api.pluggy.ai';
const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID || '';
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET || '';

async function getApiKey() {
  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    throw new Error('Missing PLUGGY_CLIENT_ID or PLUGGY_CLIENT_SECRET');
  }

  const resp = await fetch(`${PLUGGY_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Pluggy auth failed: ${resp.status} ${body}`);
  }

  const data = await resp.json();
  return data.apiKey;
}

async function fetchPluggy(url, apiKey) {
  const resp = await fetch(url, { headers: { 'X-API-KEY': apiKey } });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Pluggy request failed: ${resp.status} ${body}`);
  }
  return resp.json();
}

app.post('/api/pluggy/token', async (req, res) => {
  try {
    const apiKey = await getApiKey();
    const tokenResponse = await fetch(`${PLUGGY_BASE}/connect_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        clientUserId: 'usuario-dashboard-1',
        avoidDuplicates: true,
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new Error(`Pluggy connect token failed: ${tokenResponse.status} ${body}`);
    }

    const data = await tokenResponse.json();
    res.json({ connectToken: data.accessToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pluggy/accounts', async (req, res) => {
  const { itemId } = req.query;
  if (!itemId) {
    return res.status(400).json({ error: 'Missing itemId' });
  }

  try {
    const apiKey = await getApiKey();
    const accounts = await fetchPluggy(`${PLUGGY_BASE}/items/${itemId}/accounts`, apiKey);
    res.json(accounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pluggy/transactions', async (req, res) => {
  const { accountId, itemId, from, to, pageSize = 500 } = req.query;
  if ((!accountId && !itemId) || !from || !to) {
    return res.status(400).json({ error: 'Missing accountId or itemId, and from/to' });
  }

  try {
    const apiKey = await getApiKey();
    const url = new URL(`${PLUGGY_BASE}/transactions`);
    if (accountId) {
      url.searchParams.set('accountId', accountId);
    } else {
      url.searchParams.set('itemId', itemId);
    }
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    url.searchParams.set('pageSize', pageSize);

    const transactions = await fetchPluggy(url.toString(), apiKey);
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

module.exports = app;
