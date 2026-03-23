const Anthropic = require('@anthropic-ai/sdk');
const settingsService = require('./settingsService');

async function _getClient(userId) {
  const s = await settingsService.getSettings(userId);
  if (!s.anthropic_api_key) throw new Error('Anthropic API key not configured. Go to Settings to add it.');
  return new Anthropic({ apiKey: s.anthropic_api_key });
}

const ANALYZE_SYSTEM_PROMPT = `You are an expert TradingView Pine Script analyst. When given a Pine Script, analyze it and return ONLY a JSON object — no extra text, no markdown, no code fences.

The JSON must follow this exact schema:
{
  "summary": "2-3 sentence plain English description of what this indicator does and when it signals — no technical jargon",
  "scriptType": "indicator" or "strategy",
  "buyConditionName": "the exact name string used in alertcondition() for the buy/long signal. If no alertcondition() exists, describe the buy trigger in 3-6 words (e.g. 'Bull Unicorn Pattern Detected')",
  "sellConditionName": "the exact name string used in alertcondition() for the sell/short signal. If no alertcondition() exists, describe the sell trigger in 3-6 words",
  "buyAlertJson": { "symbol": "{{ticker}}", "action": "buy", "price": "{{close}}" },
  "sellAlertJson": { "symbol": "{{ticker}}", "action": "sell", "price": "{{close}}" },
  "suggestedOrderSet": {
    "entry_type": "market" or "limit_signal" or "limit_offset",
    "profit_target_ticks": number (infer from script if possible, default 20),
    "stop_ticks": number (infer from script if possible, default 15),
    "stop_type": "fixed" or "trailing",
    "breakeven_enabled": true or false,
    "breakeven_ticks": number or null
  },
  "questions": [
    {
      "id": "contracts",
      "question": "<Write a specific question using the indicator name — e.g. 'How many contracts do you want to trade each time [Indicator Name] fires a signal?'>",
      "type": "number",
      "unit": "contracts",
      "default": 1,
      "min": 1
    },
    {
      "id": "entry_type",
      "question": "<Personalised — reference the buy condition name, e.g. 'When [buyConditionName] triggers, how do you want TradeFlow to enter the trade?'>",
      "type": "choice",
      "options": [
        { "label": "Market order — fill immediately at current price", "value": "market" },
        { "label": "Limit order — wait for the signal price or better", "value": "limit_signal" }
      ],
      "default": "market"
    },
    {
      "id": "profit_target_ticks",
      "question": "<Personalised — e.g. 'Once [Indicator Name] gets you into a trade, how many ticks of profit should TradeFlow lock in before closing the position?'>",
      "type": "number",
      "unit": "ticks",
      "default": 20,
      "min": 1
    },
    {
      "id": "stop_ticks",
      "question": "<Personalised — e.g. 'If [Indicator Name] fires but the market immediately moves against you, how many ticks of loss are you willing to accept before TradeFlow cuts the trade?'>",
      "type": "number",
      "unit": "ticks",
      "default": 15,
      "min": 1
    },
    {
      "id": "stop_type",
      "question": "<Personalised — e.g. 'As your [Indicator Name] trade moves in your favour, should the stop loss follow the price or stay fixed where it was originally placed?'>",
      "type": "choice",
      "options": [
        { "label": "Fixed — stop stays where it was placed", "value": "fixed" },
        { "label": "Trailing — stop follows price as it moves in your favour", "value": "trailing" }
      ],
      "default": "fixed"
    },
    {
      "id": "breakeven",
      "question": "<Personalised — e.g. 'Would you like TradeFlow to automatically move your stop to your entry price once your [Indicator Name] trade reaches a certain profit — so you can never lose on that trade?'>",
      "type": "toggle_with_number",
      "unit": "ticks in profit",
      "default_enabled": false,
      "default_value": 10
    }
  ]
}

Rules:
- buyAlertJson/sellAlertJson: always include symbol, action, price. Add any additional fields the script alertcondition message uses.
- suggestedOrderSet: use "market" entry_type unless script clearly implies limit entries. Infer TP and SL from risk/reward settings in the script if present (look for reward/risk variables, target/stop inputs). Default 20 TP / 15 SL if not inferable. Use "trailing" only if script has trailing stop logic. Set breakeven_enabled true and breakeven_ticks to half of profit_target_ticks if the script mentions breakeven logic.
- questions: Write all 6 questions in this exact order with these exact ids. Replace every <...> placeholder with your actual question text. Every question MUST use the indicator actual name and reference specific details (buy/sell condition names, strategy type, etc.). Each question must be a complete natural sentence a non-technical trader can immediately understand. The numeric defaults in questions must match the values in suggestedOrderSet (profit_target_ticks, stop_ticks, breakeven_ticks).
- Return ONLY the JSON object.`;

function stripCodeFences(text) {
  return text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
}

async function analyzeScript(scriptContent, userId) {
  const client = await _getClient(userId);
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: ANALYZE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Analyze this Pine Script:\n\n${scriptContent}`,
      },
    ],
  });

  const raw = message.content[0].text;
  const cleaned = stripCodeFences(raw);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Could not read this script. Make sure it is valid Pine Script (v4 or v5).');
  }

  return parsed;
}

const ALERT_SCRIPT_SYSTEM_PROMPT = `You are an expert TradingView Pine Script developer. Your job is to take an existing Pine Script indicator and add two alertcondition() calls to it so it works with TradeFlow's webhook system.

Rules:
- Study the script carefully to identify the exact Pine Script expression or variable that evaluates to true on a buy/long signal, and the one that evaluates to true on a sell/short signal.
- Append these two lines at the very end of the script (after all existing code):
  alertcondition(BUY_EXPR, "TradeFlow Buy", BUY_JSON)
  alertcondition(SELL_EXPR, "TradeFlow Sell", SELL_JSON)
- Replace BUY_EXPR and SELL_EXPR with the actual Pine Script expressions.
- Replace BUY_JSON and SELL_JSON with the JSON strings provided.
- If the script already has alertcondition() calls, keep them AND add the new TradeFlow ones at the end.
- Return ONLY the complete modified Pine Script — no explanation, no markdown, no code fences. Just the raw Pine Script code.`;

async function generateAlertScript(originalContent, analysis, userId) {
  const client = await _getClient(userId);
  const buyJson  = JSON.stringify(analysis.buyAlertJson);
  const sellJson = JSON.stringify(analysis.sellAlertJson);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: ALERT_SCRIPT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Add TradeFlow alert conditions to this Pine Script.\n\nBUY_JSON: '${buyJson}'\nSELL_JSON: '${sellJson}'\n\nPine Script:\n\n${originalContent}`,
      },
    ],
  });

  return message.content[0].text.trim();
}

module.exports = { analyzeScript, generateAlertScript };
