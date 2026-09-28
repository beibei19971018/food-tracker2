// Cloudflare 「_worker.js」進階模式：由這支腳本全權處理所有請求。
//   POST /analyze-exercise  運動熱量估算
//   POST /analyze-food      食物估算（1 顆拳頭的量 = 1 份）
//   其餘請求一律交給靜態檔案（env.ASSETS）
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/analyze-exercise') {
      return handleExercise(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/analyze-food') {
      return handleFood(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleExercise(request, env) {
  try {
    const { text } = await request.json();
    if (!text) return json({ error: 'missing_text' }, 400);

    const prompt = `使用者記錄了一項運動："${String(text).slice(0, 100)}"。請估算並只回傳 JSON，格式：{"name":"運動名稱簡稱","minutes":數字或null,"calories":估計消耗大卡數字}。以一般成人中等體重估算即可，沒有時間資訊時 minutes 給 null 但仍要估 calories。只回傳 JSON，不要其他文字，不要用 markdown code fence。`;

    const r = await askGroq(env, prompt);
    if (r.error) return r.error;
    return json(r.data, 200);
  } catch (e) {
    return json({ error: 'server_error', message: String((e && e.message) || e) }, 500);
  }
}

async function handleFood(request, env) {
  try {
    const { name } = await request.json();
    if (!name) return json({ error: 'missing_name' }, 400);

    const prompt = `使用者記錄了食物："${String(name).slice(0, 60)}"。請以「一顆拳頭大小的量」為 1 份，估算這個食物 1 份的熱量與蛋白質。只回傳 JSON，格式：{"calories":估計大卡數字,"protein":估計蛋白質克數數字}。只回傳 JSON，不要其他文字，不要用 markdown code fence。`;

    const r = await askGroq(env, prompt);
    if (r.error) return r.error;

    const calories = Number(r.data.calories);
    const protein = Number(r.data.protein);
    if (!isFinite(calories) || !isFinite(protein)) {
      return json({ error: 'invalid_json', raw: r.data }, 502);
    }
    return json({ calories, protein }, 200);
  } catch (e) {
    return json({ error: 'server_error', message: String((e && e.message) || e) }, 500);
  }
}

// 共用：呼叫 Groq，回傳 { data } 或 { error: Response }
async function askGroq(env, prompt) {
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      error: json({
        error: 'missing_api_key',
        message: '尚未設定 GROQ_API_KEY 環境變數',
        visibleEnvNames: Object.keys(env || {})
      }, 500)
    };
  }

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      max_completion_tokens: 1024,
      reasoning_effort: 'low',
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    return { error: json({ error: 'groq_error', detail: errText }, resp.status) };
  }

  const data = await resp.json();
  const raw = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  const cleaned = raw.replace(/```json|```/g, '').trim();

  try {
    return { data: JSON.parse(cleaned) };
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return { data: JSON.parse(match[0]) }; } catch (e2) { /* fall through */ }
    }
    return { error: json({ error: 'invalid_json', raw: cleaned }, 502) };
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
