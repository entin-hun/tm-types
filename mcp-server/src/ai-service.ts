
import { readFileSync, existsSync } from 'fs';

export interface AIConfig {
    openRouterKey?: string;
    geminiKey?: string;
    groqKey?: string;
    modelName?: string;
}

const CONFIG_PATH = '/opt/lca-chat/data/config.json';

export function getAIKeys(): AIConfig {
    try {
        if (existsSync(CONFIG_PATH)) {
            const data = readFileSync(CONFIG_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Failed to read LCA config:', e);
    }
    return {};
}

interface ExtractionRequest {
    text: string;
    attachments?: { name: string; content: string }[];
}

function parseJSON(text: string) {
    if (!text) return null;
    try {
        // Try strict parse
        return JSON.parse(text);
    } catch (e) {
        // Try to find JSON block
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch (e2) { }
        }
        // Try cleaning markdown
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        try { return JSON.parse(clean); } catch (e3) { }
        return null;
    }
}

function toGrams(value?: number, unit?: string): number {
    if (typeof value !== 'number' || !isFinite(value)) return 0;
    const u = (unit || '').toLowerCase();
    if (u === 'kg' || u === 'kilogram' || u === 'kilograms') return Math.round(value * 1000);
    if (u === 'g' || u === 'gram' || u === 'grams') return Math.round(value);
    if (u === 'l' || u === 'liter' || u === 'litre') return Math.round(value * 1000);
    if (u === 'ml' || u === 'milliliter' || u === 'millilitre') return Math.round(value);
    return Math.round(value);
}

function normalizeExtractionResult(raw: any) {
    if (!raw || typeof raw !== 'object') return raw;
    const populated = raw.populated || {};
    const instance = populated.instance || {};
    const process = populated.process || {};

    const instanceName = instance.name || instance.type || 'Unknown Product';
    const instanceQty = typeof instance.quantity === 'number'
        ? toGrams(instance.quantity, instance.quantityUnit)
        : toGrams(instance.quantity?.value, instance.quantity?.unit);

    const inputInstances = Array.isArray(process.inputInstances) ? process.inputInstances : [];
    const normalizedInputs = inputInstances.map((input: any) => {
        const name = input?.name || input?.instance?.type || input?.instance?.name || 'Unknown Input';
        const grams = typeof input?.quantity === 'number'
            ? toGrams(input?.quantity, input?.quantityUnit)
            : toGrams(input?.amount?.value, input?.amount?.unit);
        return {
            type: 'local',
            quantity: grams,
            instance: {
                category: 'food',
                type: name,
                bio: false,
                quantity: 0
            }
        };
    });

    const normalizedInputsWithWater = (() => {
        const totalInputs = normalizedInputs.reduce((sum: number, item: { quantity?: number }) => sum + (item.quantity || 0), 0);
        const remaining = instanceQty > 0 ? Math.max(0, instanceQty - totalInputs) : 0;
        const text = `${instanceName} ${instance.description || ''}`.toLowerCase();
        const waterLikely = [
            'water', 'liquid', 'beverage', 'drink', 'juice', 'tea', 'coffee',
            'soup', 'broth', 'cleaner', 'detergent', 'soap', 'vinegar',
            'surface', 'window', 'spray'
        ].some((k) => text.includes(k));

        if (remaining > 0 && waterLikely) {
            return [
                ...normalizedInputs,
                {
                    type: 'local',
                    quantity: remaining,
                    instance: {
                        category: 'food',
                        type: 'Water',
                        bio: false,
                        quantity: 0
                    }
                }
            ];
        }

        return normalizedInputs;
    })();

    return {
        summary: raw.summary || `Found ${normalizedInputsWithWater.length} inputs`,
        populated: {
            instance: {
                category: 'food',
                type: instanceName,
                bio: false,
                quantity: instanceQty,
                description: instance.description
            },
            process: {
                type: 'blending',
                timestamp: Date.now(),
                inputInstances: normalizedInputsWithWater
            }
        }
    };
}

export async function runExtraction(req: ExtractionRequest, transientKeys?: AIConfig) {
    const keys = transientKeys?.geminiKey || transientKeys?.groqKey || transientKeys?.openRouterKey
        ? { ...getAIKeys(), ...transientKeys }
        : getAIKeys();
    
    // Construct Prompt
    const prompt = `
You are an expert Life Cycle Assessment (LCA) data extractor.
Your task is to extract structured product and process information from the provided text and files.

Output Structure (JSON only):
{
  "summary": "Brief summary of what was extracted (e.g. 'Found 1 product and 5 ingredients')",
  "populated": {
    "instance": {
      "name": "Product Name",
      "description": "Product Description usually including brand, weight, packaging info",
      "quantity": { "value": 1, "unit": "kg" }
    },
    "process": {
      "name": "Production of [Product Name]",
      "inputInstances": [
        {
          "name": "Ingredient/Input Name",
          "amount": { "value": 10, "unit": "g" },
          "description": "Any details about origin, transport, or processing"
        }
      ]
    }
  }
}

Rules:
1. Extract as much detail as possible.
2. Normalize units to standard metric if possible (kg, g, l, ml, kWh).
3. If specific amounts aren't found, estimate reasonable defaults or leave null.
4. "inputInstances" should list ingredients, energy, transport, or packaging inputs.
5. Return ONLY raw JSON, no markdown formatting.

Input Text:
${req.text}

${req.attachments?.map((a: any) => `Attachment (${a.name}):\n${a.content}`).join('\n\n') || ''}
`;

    // Try Groq First
    if (keys.groqKey) {
        try {
            console.error('[AI] Using Groq...');
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${keys.groqKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1
                })
            });
            if (res.ok) {
                const data: any = await res.json();
                const content = data.choices[0]?.message?.content;
                return normalizeExtractionResult(parseJSON(content));
            } else {
                console.error('[AI] Groq failed:', await res.text());
            }
        } catch (e) {
            console.error('[AI] Groq error:', e);
        }
    }
    
    // Try Gemini
    if (keys.geminiKey) {
        try {
            const modelName = keys.modelName && keys.modelName.startsWith('gemini') 
                ? keys.modelName 
                : 'gemini-1.5-flash';
            const modelPath = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
            console.error(`[AI] Using Gemini model: ${modelPath}`);
            const url = `https://generativelanguage.googleapis.com/v1/${modelPath}:generateContent?key=${keys.geminiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            if (res.ok) {
                const data: any = await res.json();
                const content = data.candidates[0]?.content?.parts[0]?.text;
                return normalizeExtractionResult(parseJSON(content));
            }
        } catch (e) {
            console.error('[AI] Gemini error:', e);
        }
    }

    return { error: "No AI provider available or all failed" };
}
