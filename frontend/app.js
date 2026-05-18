const state = {
  transactions: [],
  categoryTotals: {},
  chart: null,
};

const DOM = {
  fileInput: document.getElementById('fileInput'),
  bankSelect: document.getElementById('bankSelect'),
  connectButton: document.getElementById('connectButton'),
  incomeValue: document.getElementById('incomeValue'),
  expenseValue: document.getElementById('expenseValue'),
  balanceValue: document.getElementById('balanceValue'),
  txCount: document.getElementById('txCount'),
  transactionBody: document.getElementById('transactionBody'),
  categoryChart: document.getElementById('categoryChart').getContext('2d'),
};

const CATEGORY_MAP = {
  Alimentação: 'Alimentação',
  Transporte: 'Transporte',
  Moradia: 'Moradia',
  Saúde: 'Saúde',
  Lazer: 'Lazer',
  Educação: 'Educação',
  Salário: 'Salário',
  Investimentos: 'Investimentos',
  Outros: 'Outros',
};

const PLUGGY_SCRIPT_URLS = [
  'https://cdn.pluggy.ai/pluggy-connect/v3/pluggy-connect.js',
  'https://cdn.pluggy.ai/pluggy-connect/v3/pluggy-connect.min.js',
  'https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js',
  'https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.min.js',
  'https://cdn.pluggy.ai/pluggy-connect/v1/pluggy-connect.js',
  'https://cdn.pluggy.ai/pluggy-connect/v1/pluggy-connect.min.js',
  'https://cdn.pluggy.ai/pluggy-connect/pluggy-connect.js',
  'https://cdn.pluggy.ai/pluggy-connect/pluggy-connect.min.js',
  'https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js',
  'https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.min.js',
];

function loadPluggyConnectLibrary() {
  return new Promise((resolve, reject) => {
    console.log('Tentando carregar PluggyConnect library');
    if (window.PluggyConnect) {
      console.log('PluggyConnect já está disponível em window');
      resolve(window.PluggyConnect);
      return;
    }

    const tryUrl = (index) => {
      if (index >= PLUGGY_SCRIPT_URLS.length) {
        reject(new Error('Não foi possível carregar o Pluggy Connect a partir de nenhuma URL conhecida.'));
        return;
      }

      const url = PLUGGY_SCRIPT_URLS[index];
      console.log('Tentando URL Pluggy:', url);

      const existingScript = document.querySelector(`script[src="${url}"]`);
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.addEventListener('load', () => {
        console.log('Script Pluggy carregado via', url);
        if (window.PluggyConnect) {
          resolve(window.PluggyConnect);
        } else {
          console.warn('PluggyConnect não definido após carregar', url);
          script.remove();
          tryUrl(index + 1);
        }
      });
      script.addEventListener('error', () => {
        console.warn('Falha ao carregar url Pluggy:', url);
        script.remove();
        tryUrl(index + 1);
      });
      document.body.appendChild(script);
    };

    tryUrl(0);
  });
}

console.log('Finance dashboard app init');

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function updateSummary() {
  const income = state.transactions
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.value, 0);
  const expense = state.transactions
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.value, 0);
  const balance = income - expense;

  DOM.incomeValue.textContent = formatCurrency(income);
  DOM.expenseValue.textContent = formatCurrency(expense);
  DOM.balanceValue.textContent = formatCurrency(balance);
  DOM.txCount.textContent = state.transactions.length;
}

function renderTransactions() {
  DOM.transactionBody.innerHTML = '';
  const slice = state.transactions.slice(-12).reverse();
  slice.forEach(tx => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${tx.date}</td>
      <td>${tx.desc}</td>
      <td>${tx.cat}</td>
      <td>${tx.bank}</td>
      <td>${tx.type === 'expense' ? '-' : ''}${formatCurrency(tx.value)}</td>
    `;
    DOM.transactionBody.appendChild(row);
  });
}

function updateCategoryTotals() {
  state.categoryTotals = {};
  state.transactions.forEach(tx => {
    if (!state.categoryTotals[tx.cat]) {
      state.categoryTotals[tx.cat] = 0;
    }
    state.categoryTotals[tx.cat] += tx.value;
  });
}

function renderCategoryChart() {
  updateCategoryTotals();
  const labels = Object.keys(state.categoryTotals);
  const data = labels.map(label => state.categoryTotals[label]);

  if (state.chart) {
    state.chart.data.labels = labels;
    state.chart.data.datasets[0].data = data;
    state.chart.update();
    return;
  }

  state.chart = new Chart(DOM.categoryChart, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          label: 'Gastos por categoria',
          data,
          backgroundColor: [
            '#1d4ed8', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#0ea5e9', '#e11d48', '#14b8a6', '#6b7280',
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
      },
    },
  });
}

function addTransactions(items) {
  state.transactions = [...state.transactions, ...items];
  updateSummary();
  renderTransactions();
  renderCategoryChart();
}

function normalizeCsvLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return [];
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (char === ';' || char === ',')) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.length) {
    values.push(current.trim());
  }

  return values;
}

function parseCsvRows(content) {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized.split('\n').map(normalizeCsvLine).filter(row => row.length > 0);
}

function parseAmount(rawValue, typeValue) {
  if (!rawValue) return 0;
  let value = rawValue.replace(/[^\d,-]/g, '').replace('.', '').replace(',', '.');
  if (!value) return 0;
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) return 0;

  const type = typeValue ? typeValue.toLowerCase() : '';
  if (type.includes('deb') || type.includes('saída') || type.includes('neg')) {
    return Math.abs(parsed) * -1;
  }
  return parsed;
}

function parseDate(rawDate) {
  const date = (rawDate || '').trim();
  if (!date) return new Date().toISOString().slice(0, 10);

  const ddmmyyyy = date.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  }

  const yyyymmdd = date.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
  }

  const fallback = new Date(date);
  return Number.isNaN(fallback.getTime())
    ? new Date().toISOString().slice(0, 10)
    : fallback.toISOString().slice(0, 10);
}

function parseCsvByBank(rows, bank) {
  const results = [];
  if (rows.length === 0) return results;

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const hasHeader = headers.some(cell => /data|descri|histórico|valor|amount/i.test(cell));
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const findIndex = keys => {
    for (const key of keys) {
      const idx = headers.findIndex(h => h.includes(key));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const dateIdx = findIndex(['data', 'date']);
  const descIdx = findIndex(['descri', 'histórico', 'historia', 'description', 'categoria']);
  const amountIdx = findIndex(['valor', 'amount', 'montante', 'total']);
  const typeIdx = findIndex(['tipo', 'tipo de operação', 'operation', 'natureza']);

  dataRows.forEach(row => {
    if (!row || row.length === 0) return;

    let date = dateIdx !== -1 ? parseDate(row[dateIdx]) : '';
    let desc = 'Transação';
    if (descIdx !== -1) desc = row[descIdx];

    let rawValue = amountIdx !== -1 ? row[amountIdx] : '';
    let rawType = typeIdx !== -1 ? row[typeIdx] : '';

    if (!rawValue && bank === 'Cartão Caju' && row.length >= 4) {
      rawValue = row[2];
      rawType = row[3];
    }

    if (!rawValue && bank === 'C6 Bank' && row.length >= 3) {
      rawValue = row[2];
      rawType = row[3] || rawType;
    }

    if (!rawValue && bank === 'Banco do Brasil' && row.length >= 4) {
      rawValue = row[2];
      rawType = row[3] || rawType;
    }

    const amount = parseAmount(rawValue, rawType);
    if (amount === 0) return;

    const type = amount >= 0 ? 'income' : 'expense';
    const value = Math.abs(amount);

    if (!date) {
      date = new Date().toISOString().slice(0, 10);
    }

    results.push({
      id: Date.now() + Math.random(),
      type,
      desc: desc || 'Transação',
      value,
      date,
      cat: 'Outros',
      bank,
    });
  });

  return results;
}

function parseOFXorCSV(content, bank) {
  const results = [];
  const isOFX = content.includes('<OFX>') || content.includes('<STMTTRN>');

  if (isOFX) {
    const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let m;
    while ((m = re.exec(content)) !== null) {
      const block = m[1];
      const amt = parseFloat((block.match(/<TRNAMT>([-\d.]+)/i) || [])[1] || '0');
      const memo = ((block.match(/<MEMO>([^<]+)/i) || [])[1] || 'Transação').trim();
      const dtRaw = ((block.match(/<DTPOSTED>(\d+)/i) || [])[1] || '');
      const date = dtRaw
        ? `${dtRaw.slice(0,4)}-${dtRaw.slice(4,6)}-${dtRaw.slice(6,8)}`
        : new Date().toISOString().slice(0, 10);
      results.push({
        id: Date.now() + Math.random(),
        type: amt >= 0 ? 'income' : 'expense',
        desc: memo,
        value: Math.abs(amt),
        date,
        cat: 'Outros',
        bank,
      });
    }
  } else {
    const rows = parseCsvRows(content);
    return parseCsvByBank(rows, bank);
  }

  return results;
}

function onFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const content = reader.result;
    const bank = DOM.bankSelect.value;
    const parsed = parseOFXorCSV(content, bank);
    if (parsed.length === 0) {
      alert('Não foi possível ler nenhum lançamento do arquivo. Verifique o formato e tente novamente.');
      return;
    }
    addTransactions(parsed);
  };
  reader.readAsText(file, 'utf-8');
}

async function requestConnectToken() {
  console.log('Solicitando connect token ao backend');
  const response = await fetch('/api/pluggy/token', { method: 'POST' });
  if (!response.ok) {
    let json = {};
    try {
      json = await response.json();
    } catch (err) {
      console.error('Não foi possível ler a resposta de erro', err);
    }
    throw new Error(json.error || `Falha ao obter Pluggy token (${response.status})`);
  }
  const body = await response.json();
  console.log('Connect token recebido', body);
  return body;
}

async function onConnectClicked() {
  try {
    console.log('onConnectClicked iniciando');
    const { connectToken } = await requestConnectToken();
    console.log('connectToken obtido:', Boolean(connectToken));
    const Pluggy = await loadPluggyConnectLibrary();
    console.log('PluggyConnect library carregada', typeof Pluggy);

    const pluggyConnect = new Pluggy({
      connectToken,
      onSuccess: async ({ item }) => {
        console.log('Pluggy onSuccess', item);
        localStorage.setItem('pluggy_item_id', item.id);
        alert('Conta conectada. Buscando transações...');
        await loadPluggyAccounts(item.id);
      },
      onError: err => {
        console.error('Pluggy error', err);
        alert('Erro na conexão Pluggy: ' + err.message);
      },
      onClose: () => {
        console.log('Widget Pluggy fechado');
      },
    });

    pluggyConnect.init();
  } catch (error) {
    console.error('Falha no fluxo de conexão Pluggy', error);
    alert('Falha ao carregar o Pluggy Connect: ' + error.message);
  }
}

function mapCategoria(cat) {
  const mapa = {
    'Food and Drink': 'Alimentação',
    Transport: 'Transporte',
    Housing: 'Moradia',
    Health: 'Saúde',
    Entertainment: 'Lazer',
    Education: 'Educação',
    Transfers: 'Outros',
    'Online Payment': 'Outros',
  };
  return mapa[cat] || 'Outros';
}

async function loadPluggyAccounts(itemId) {
  const resp = await fetch(`/api/pluggy/accounts?itemId=${encodeURIComponent(itemId)}`);
  const accounts = await resp.json();
  if (!Array.isArray(accounts)) {
    throw new Error('Resposta inválida de contas Pluggy');
  }

  const today = new Date().toISOString().slice(0, 10);
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  for (const account of accounts) {
    const txResp = await fetch(
      `/api/pluggy/transactions?accountId=${encodeURIComponent(account.id)}&from=${lastMonth}&to=${today}`
    );
    const transactions = await txResp.json();

    if (Array.isArray(transactions)) {
      const converted = transactions.map(t => ({
        id: t.id,
        type: t.type === 'CREDIT' ? 'income' : 'expense',
        desc: t.description || 'Transação Pluggy',
        value: Math.abs(t.amount || 0),
        date: (t.date || '').slice(0, 10) || today,
        cat: mapCategoria(t.category),
        bank: account.name || 'Conta Pluggy',
      }));
      addTransactions(converted);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, binding events');
  DOM.fileInput.addEventListener('change', onFileSelected);
  DOM.connectButton.addEventListener('click', () => {
    console.log('connect button clicked');
    onConnectClicked();
  });

  loadPluggyConnectLibrary()
    .then(() => console.log('Pluggy Connect script pré-carregado'))
    .catch(error => console.warn('Falha ao pré-carregar Pluggy Connect:', error.message));

  renderCategoryChart();
});
