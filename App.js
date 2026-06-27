const GLM_URL = 'http://45.194.90.209:8000/v1/chat/completions';

const history = [
  {
    role: 'system',
    content: `You are an AI assistant for SMC Insurance's Conversation Intelligence dashboard (Viveka). 
You help users find call logs, understand customer sentiment, check agent performance, and get CSAT scores.
Be concise, professional, and friendly. 
If asked for real-time data you cannot access yet, give a helpful example of what it would look like and mention that live database integration is coming.
Format lists clearly. Keep answers under 120 words unless a summary is requested.`
  }
];

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addBotMessage(html) {
  const body = document.getElementById('chatBody');
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.innerHTML = `
    <div class="msg-avatar"><i class="ti ti-robot"></i></div>
    <div class="bubble">${html}<span class="msg-time">${getTime()}</span></div>
  `;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function addUserMessage(text) {
  const body = document.getElementById('chatBody');
  const div = document.createElement('div');
  div.className = 'msg user';
  div.innerHTML = `
    <div class="msg-avatar"><i class="ti ti-user"></i></div>
    <div class="bubble">${text}<span class="msg-time">${getTime()}</span></div>
  `;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function showTyping() {
  const body = document.getElementById('chatBody');
  const div = document.createElement('div');
  div.id = 'typing';
  div.className = 'typing-wrap';
  div.innerHTML = `
    <div class="msg-avatar"><i class="ti ti-robot"></i></div>
    <div class="typing-bubble">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>
  `;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('typing');
  if (t) t.remove();
}

function callCard(agent, customer, duration, sentiment, time, company) {
  const cls = sentiment === 'Positive' ? 'pos' : sentiment === 'Negative' ? 'neg' : 'neu';
  return `
    <div class="call-card">
      <div class="call-card-header"><i class="ti ti-phone"></i> Call Record</div>
      <div class="call-row"><span class="call-label">Agent</span><span>${agent}</span></div>
      <div class="call-row"><span class="call-label">Customer</span><span>${customer}</span></div>
      <div class="call-row"><span class="call-label">Company</span><span>${company}</span></div>
      <div class="call-row"><span class="call-label">Duration</span><span>${duration}</span></div>
      <div class="call-row"><span class="call-label">Time</span><span>${time}</span></div>
      <div class="call-row"><span class="call-label">Sentiment</span><span class="badge ${cls}">${sentiment}</span></div>
    </div>
  `;
}

function getSampleCards(query) {
  const q = query.toLowerCase();
  if (q.includes('today') || q.includes('call log') || q.includes('calls from')) {
    return callCard('Riya Sharma', 'Vikram Mehta', '8m 42s', 'Positive', '10:24 AM', 'ABC Corp')
         + callCard('Arjun Patel', 'Sneha Joshi', '5m 11s', 'Negative', '11:07 AM', 'XYZ Ltd')
         + callCard('Priya Nair', 'Rohit Kumar', '12m 03s', 'Neutral', '1:45 PM', 'PQR Pvt');
  }
  if (q.includes('negative') || q.includes('unhappy') || q.includes('unsatisfied')) {
    return callCard('Arjun Patel', 'Sneha Joshi', '5m 11s', 'Negative', '11:07 AM', 'XYZ Ltd')
         + callCard('Mohit Singh', 'Kavya Reddy', '9m 30s', 'Negative', '3:12 PM', 'DEF Corp');
  }
  return '';
}

async function sendMsg() {
  const input = document.getElementById('msgInput');
  const btn = document.getElementById('sendBtn');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  btn.disabled = true;

  addUserMessage(text);
  history.push({ role: 'user', content: text });
  showTyping();

  try {
    const res = await fetch(GLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'zai-org/GLM-4.7-Flash',
        messages: history,
        max_tokens: 350,
        temperature: 0.3,
        chat_template_kwargs: { enable_thinking: false }
      })
    });

    const data = await res.json();
    const reply = data.choices[0].message.content;
    history.push({ role: 'assistant', content: reply });

    removeTyping();

    const cards = getSampleCards(text);
    addBotMessage(`<p>${reply.replace(/\n/g, '<br>')}</p>${cards}`);

  } catch (err) {
    removeTyping();
    addBotMessage(`<p style="color:#991b1b">Could not reach GLM server. Make sure you're on the ViH network and the server at <code>45.194.90.209:8000</code> is running.</p>`);
  }

  btn.disabled = false;
  input.focus();
}

function quickAsk(text) {
  document.getElementById('msgInput').value = text;
  sendMsg();
}

function clearChat() {
  if (!confirm('Clear conversation?')) return;
  const body = document.getElementById('chatBody');
  body.innerHTML = '';
  history.splice(1);
  addBotMessage('<p>Chat cleared. How can I help you?</p>');
}