const fs = require('fs');
const path = require('path');

let cachedData = null;

function loadTestData() {
  if (cachedData) return cachedData;

  const dir = path.join(__dirname, 'test_data');
  
  if (!fs.existsSync(dir)) {
    console.log('No test_data folder found');
    return [];
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const calls = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const json = JSON.parse(raw);

      const name = file.replace('.profile.json', '').replace('.agent.profile.json', '');
      const parts = name.split('-');

      const agentCompany = parts[4] || '';
      const agentName = agentCompany.split('_')[0] || 'Unknown';
      const company = agentCompany.split('_')[1] || '';

      const datePart = parts[5] || '';
      const date = datePart.length >= 8
        ? `${datePart.substring(0,4)}-${datePart.substring(4,6)}-${datePart.substring(6,8)}`
        : '';
      const time = datePart.length >= 13
        ? `${datePart.substring(9,11)}:${datePart.substring(11,13)}`
        : '';

      calls.push({
        filename: file,
        agent_id: parts[1] || '',
        agent_name: agentName,
        company: company,
        date: date,
        time: time,
        phone: parts[6] || '',
        raw: json
      });
    } catch (e) {
      // skip bad files
    }
  }

  cachedData = calls;
  console.log(`✅ Loaded ${calls.length} call records`);
  return calls;
}

module.exports = { loadTestData };