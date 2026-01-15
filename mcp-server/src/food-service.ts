
import { parse } from 'node-html-parser';
import { getAIKeys, AIConfig } from './ai-service.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TYPES_PATH = join(__dirname, "../../src/index.d.ts");

let cachedProcessTypes: string[] = [];
function getDefinedProcessTypes(): string[] {
    if (cachedProcessTypes.length > 0) return cachedProcessTypes;
    try {
        let targetPath = TYPES_PATH;
        if (existsSync(targetPath)) {
            const content = readFileSync(targetPath, 'utf-8');
            const regex = /extends\s+GenericProcess\s*\{[\s\S]*?type:\s*"([^"]+)"/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
                if (match[1] && !cachedProcessTypes.includes(match[1])) {
                    cachedProcessTypes.push(match[1]);
                }
            }
        }
    } catch (e) {
        console.error("Failed to load generic process types", e);
    }
    if (cachedProcessTypes.length === 0) {
        cachedProcessTypes = ['printing', 'milling', 'freezedrying', 'blending', 'harvest', 'sale'];
    }
    return cachedProcessTypes;
}

interface SuggestionParams {
    title?: string;
    brand?: string;
    category?: string;
    type?: string;
    ids?: { id: string; registry: string }[];
    query?: string;
    quantity?: number;
}

interface ProductInstance {
    category: string;
    type: string;
    description?: string;
    bio: boolean;
    quantity: number;
    externalSources?: any[];
    process?: any;
    format?: string;
    size?: string;
    grade?: string;
    ean?: string;
    fdcId?: string;
    properties?: any;
    price?: any;
    iDs?: any[];
}

function rankProcessTypes(rawType: string, validTypes: string[]) {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const raw = normalize(rawType || '');
    const rawTokens = new Set(raw.split(' ').filter(Boolean));

    const has = (re: RegExp) => re.test(raw);
    const boosts: Record<string, number> = {};
    if (has(/blend|mix|beverage|drink|liquid|emulsion|infusion/)) boosts.blending = 0.35;
    if (has(/mill|grind|powder|paste/)) boosts.milling = 0.35;
    if (has(/dry|dehydrat|freeze/)) boosts.freezedrying = 0.35;
    if (has(/print/)) boosts.printing = 0.35;

    const scored = validTypes.map((t) => {
        const tv = normalize(t);
        const tTokens = new Set(tv.split(' ').filter(Boolean));
        let inter = 0;
        for (const tok of rawTokens) if (tTokens.has(tok)) inter++;
        const union = rawTokens.size + tTokens.size - inter || 1;
        const tokenScore = inter / union;
        const boost = boosts[t] || 0;
        return { type: t, score: tokenScore + boost };
    });

    return scored.sort((a, b) => b.score - a.score);
}

function pickClosestProcessType(rawType: string, validTypes: string[], label?: string): string {
    if (validTypes.includes(rawType)) return rawType;
    const ranked = rankProcessTypes(rawType, validTypes);
    if (ranked.length === 0) return validTypes[0] || 'blending';
    const top = ranked[0]?.type || validTypes[0] || 'blending';
    if (label) {
        const topList = ranked.slice(0, 5).map(r => `${r.type}:${r.score.toFixed(2)}`).join(', ');
        console.log(`[Food] Process type ranking for ${label}: ${topList}. Selected: ${top}`);
    }
    return top;
}

function normalizeProcessTypes(instance: ProductInstance, validTypes: string[], label?: string) {
    if (!instance || !instance.process) return;
    instance.process.type = pickClosestProcessType(instance.process.type, validTypes, label || instance.type || 'unknown');
    if (instance.process.inputInstances && instance.process.inputInstances.length) {
        for (const input of instance.process.inputInstances) {
            if (input && typeof input.instance === 'object') {
                normalizeProcessTypes(input.instance, validTypes, input.instance.type || 'input');
            }
        }
    }
}

function extractIngredientsFromText(text: string): { name: string; percent?: number }[] {
    if (!text) return [];
    const lower = text.toLowerCase();
    const keywords = ['ingredients', 'composition', 'összetevők', 'zutaten', 'ingrédients', 'ingredientes', 'složení', 'zloženie'];
    const matchKeyword = keywords.find(k => lower.includes(k));
    if (!matchKeyword) return [];

    const idx = lower.lastIndexOf(matchKeyword);
    const slice = text.slice(idx, idx + 2000);
    const line = slice.replace(/\s+/g, ' ');

    const pattern = new RegExp(`${matchKeyword}\s*[:\-]\s*([^\.]+)`, 'i');
    const match = line.match(pattern);
    const raw = match ? match[1] : line.slice(matchKeyword.length);

    const cleaned = raw
        .replace(/\<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const parsePercent = (s: string): number | undefined => {
        const ltMatch = s.match(/<\s*(\d+(?:[\.,]\d+)?)\s*%/);
        if (ltMatch) return parseFloat(ltMatch[1].replace(',', '.'));
        const match = s.match(/(\d+(?:[\.,]\d+)?)\s*%/);
        if (match) return parseFloat(match[1].replace(',', '.'));
        return undefined;
    };

    return cleaned
        .split(/,|;|\(|\)/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/^[-–•]+\s*/g, '').trim())
        .map((s) => {
            const percent = parsePercent(s);
            const name = s.replace(/\d+(?:[\.,]\d+)?\s*%/g, '').trim();
            return { name, percent };
        })
        .filter((s) => s.name.length > 1);
}

function inferTotalGrams(query: string, contextText: string, ids?: { id: string; registry: string }[], explicitQuantity?: number): number | null {
    if (typeof explicitQuantity === 'number' && explicitQuantity > 0) return explicitQuantity;
    const sources = [query, contextText, ...(ids || []).map((i) => i.id || '')].join(' ');
    const lower = sources.toLowerCase();

    const literMatch = lower.match(/(\d+(?:[\.,]\d+)?)\s*(l|liter|litre)\b/);
    if (literMatch) return Math.round(parseFloat(literMatch[1].replace(',', '.')) * 1000);

    const mlMatch = lower.match(/(\d+(?:[\.,]\d+)?)\s*ml\b/);
    if (mlMatch) return Math.round(parseFloat(mlMatch[1].replace(',', '.')));

    const kgMatch = lower.match(/(\d+(?:[\.,]\d+)?)\s*kg\b/);
    if (kgMatch) return Math.round(parseFloat(kgMatch[1].replace(',', '.')) * 1000);

    const gMatch = lower.match(/(\d+(?:[\.,]\d+)?)\s*g\b/);
    if (gMatch) return Math.round(parseFloat(gMatch[1].replace(',', '.')));

    if (lower.includes('1l') || lower.includes('1 liter') || lower.includes('1 litre')) return 1000;
    return null;
}

function normalizeInputQuantitiesToGrams(inputInstances: any[], totalGrams: number | null) {
    if (!totalGrams || !Array.isArray(inputInstances) || inputInstances.length === 0) return;
    const qtys = inputInstances.map((i) => Number(i?.quantity || 0));
    const sum = qtys.reduce((a, b) => a + b, 0);
    const looksLikePercent = sum > 0 && sum <= 110 && qtys.every((q) => q >= 0 && q <= 100);
    if (!looksLikePercent) return;

    let gramsSum = 0;
    for (const input of inputInstances) {
        const percent = Number(input?.quantity || 0);
        const grams = Math.round((totalGrams * percent) / 100);
        input.quantity = grams;
        gramsSum += grams;
    }

    if (gramsSum < totalGrams) {
        const water = inputInstances.find((i) => {
            const n = (i?.instance?.type || i?.instance?.name || '').toLowerCase();
            return n.includes('water') || n.includes('víz');
        });
        if (water) {
            water.quantity = (water.quantity || 0) + (totalGrams - gramsSum);
        }
    }
}

export async function suggestFood(params: SuggestionParams, transientKeys?: AIConfig): Promise<any> {
    const configKeys = getAIKeys();
    const keys = { ...configKeys, ...transientKeys };
    
    let contextText = '';
    if (params.ids && Array.isArray(params.ids)) {
        for (const ref of params.ids) {
            if (ref.registry === 'url' && ref.id.startsWith('http')) {
                try {
                    console.log(`[Food] Scraping ${ref.id}`);
                    const res = await fetch(ref.id, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TraceMarketBot/1.0)' } });
                    const html = await res.text();
                    const root = parse(html);
                    const scripts = root.querySelectorAll('script[type="application/ld+json"]');
                    let jsonLd = '';
                    for (const script of scripts) {
                        try {
                            const data = JSON.parse(script.innerText);
                            if (data.recipeIngredient) jsonLd += JSON.stringify(data.recipeIngredient) + '\n';
                            else if (data['@graph']) {
                                const recipe = data['@graph'].find((n: any) => n['@type'] === 'Recipe' || n['@type'] === 'Product');
                                if (recipe && recipe.recipeIngredient) jsonLd += JSON.stringify(recipe.recipeIngredient) + '\n';
                            } else if (JSON.stringify(data).length < 3000) {
                                jsonLd += JSON.stringify(data) + '\n';
                            }
                        } catch (e) {}
                    }
                    const body = root.querySelector('body')?.text || '';
                    const cleanBody = body.replace(/\s+/g, ' ');
                    const tailWindow = 8000;
                    let textExtract = cleanBody.slice(Math.max(0, cleanBody.length - tailWindow));
                    const keywords = ['ingredients', 'composition', 'összetevők', 'zutaten', 'ingrédients', 'ingredientes', 'složení', 'zloženie'];
                    const lowerBody = cleanBody.toLowerCase();
                    const match = keywords.find(k => lowerBody.includes(k));
                    if (match) {
                        const ingrIndex = lowerBody.lastIndexOf(match);
                        const start = Math.max(0, ingrIndex);
                        // Extract a larger window around the keyword to ensure we capture the list
                        // Using a sliding window: 100 chars before, 2000 after
                        const safeStart = Math.max(0, ingrIndex - 100);
                        textExtract = cleanBody.slice(safeStart, safeStart + 3000);
                        console.log(`[Food] Found ingredient keyword '${match}' at index ${ingrIndex}. Extracting...`);
                    }
                    contextText += `\n--- Context from ${ref.id} ---\nJSON-LD: ${jsonLd}\nText: ${textExtract}\n----------------\n`;
                } catch(e) { console.error(`[Food] Failed to scrape ${ref.id}`, e); }
            }
        }
    }

    const query = params.query || params.title || params.type || '';
    if (!query) return { suggestions: [] };
    
    const fetchWithTimeout = async (url: string, timeoutMs: number) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(id);
            return res;
        } catch (e) { clearTimeout(id); throw e; }
    };

    let products: any[] = [];
    let fdcProducts: any[] = [];

    const searchOFF = async () => {
        try {
            const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=12`;
            const offRes = await fetchWithTimeout(offUrl, 12000);
            if (offRes.ok) {
                 const data: any = await offRes.json();
                 products = data.products || [];
            }
        } catch (e) {}
    };

    const searchFDC = async () => {
        try {
            const fdcKey = process.env.FDC_API_KEY || 'DEMO_KEY';
            const fdcUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&dataType=Foundation,SR%20Legacy,Branded&pageSize=5&api_key=${fdcKey}`;
            const fdcRes = await fetchWithTimeout(fdcUrl, 12000);
             if (fdcRes.ok) {
                 const data: any = await fdcRes.json();
                 fdcProducts = data.foods || [];
            }
        } catch(e) {}
    };

    await Promise.allSettled([searchOFF(), searchFDC()]);

    const candidates = [
        ...products.map(p => ({
            source: 'OpenFoodFacts', name: p.product_name, ingredients: p.ingredients_text, id: p.code,
            brands: p.brands, quantity: p.quantity
        })).slice(0, 10),
        ...fdcProducts.map(f => ({
            source: 'USDA FDC', name: f.description, ingredients: f.ingredients, id: f.fdcId
        })).slice(0, 5)
    ];

    const validProcessTypes = getDefinedProcessTypes();
    const rankedProcessTypes = validProcessTypes.filter(t => t !== 'harvest' && t !== 'sale');
    
    const prompt = `
You are a food production engineer.
User Query: "${query}"
Context Info: ${JSON.stringify(params)}
Scraped Context: "${contextText}"
Potential Reference Products: ${JSON.stringify(candidates, null, 2)}

Task: Decompose this food product into a valid Product Instance JSON object (flat structure, no root wrapper).
Expected Structure:
{
  "category": "food",
  "type": "Product Name",
  "description": "Detailed description",
  "quantity": 0,
  "process": {
      "type": "...", 
      "inputInstances": [ 
          { "instance": { "type": "Ingredient Name", "category": "ingredient" }, "quantity": 0.1 } 
      ]
  }
}

Rules:
1. Do not wrap the result in "product" or any other root key. Return the object directly.
2. 'process.type' strictly one of: [${validProcessTypes.map(t => `'${t}'`).join(', ')}].
3. Exclude 'harvest'/'sale' unless explicit.
4. Input instances from Context or candidates. Extract all ingredients found.
5. Quantity: real usage for parents, 0 if unknown (never 1000 default).
6. Price: Do not include.
7. IDs: Use candidates if matching.
Output JSON only.
`;
     
    let aiResult = null;
    const extractedIngredients = extractIngredientsFromText(contextText);
    const totalGrams = inferTotalGrams(query, contextText, params.ids, params.quantity);
    console.log(`[Food] Extracted ${extractedIngredients.length} ingredients from context. Total grams: ${totalGrams}`);
    if (extractedIngredients.length > 0) {
        console.log(`[Food] Ingredients:`, extractedIngredients.map(i => `${i.name} (${i.percent ?? 'no %}'})`).join(', '));
    }
    
    if (keys.groqKey) {
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${keys.groqKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1
                })
            });
            if (res.ok) {
                const data: any = await res.json();
                const content = data.choices[0]?.message?.content || '';
                const match = content.match(/\{[\s\S]*\}/);
                if (match) aiResult = JSON.parse(match[0]);
            }
        } catch(e) {}
    } else if (keys.openRouterKey) {
        try {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${keys.openRouterKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'openai/gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1
                })
            });
            if (res.ok) {
                const data: any = await res.json();
                const content = data.choices[0]?.message?.content || '';
                const match = content.match(/\{[\s\S]*\}/);
                if (match) aiResult = JSON.parse(match[0]);
            }
        } catch(e) {}
    } else if (keys.geminiKey) {
        const modelName = keys.modelName && keys.modelName.startsWith('gemini') 
            ? keys.modelName 
            : 'gemini-1.5-flash';
        const modelPath = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
        console.log(`[Food] Using Gemini model ${modelPath} for fallback extraction...`);
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1/${modelPath}:generateContent?key=${keys.geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1 }
                })
            });
            if (res.ok) {
                const data: any = await res.json();
                const content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
                const match = content.match(/\{[\s\S]*\}/);
                if (match) aiResult = JSON.parse(match[0]);
            }
        } catch(e) {}
    }
    
    // Fallback
    if (!aiResult) {
         aiResult = {
            category: 'food',
            type: query,
            bio: false,
            quantity: 0,
            price: { amount: 0, currency: "", type: "budget" },
            process: { type: 'blending', inputInstances: [] }
        };
    }

    if (aiResult.process?.inputInstances?.length > 0) {
        const allZero = aiResult.process.inputInstances.every((i: any) => i.quantity === 0 || i.quantity === undefined);
        console.log(`[Food] AI returned ${aiResult.process.inputInstances.length} inputs (all zero: ${allZero})`);
    }

    if (totalGrams && (!aiResult.quantity || aiResult.quantity === 0)) {
        aiResult.quantity = totalGrams;
    }
    
    const allInputsZero = aiResult?.process?.inputInstances?.length > 0 && aiResult.process.inputInstances.every((i: any) => i.quantity === 0 || i.quantity === undefined);
    const shouldUseExtracted = extractedIngredients.length > 0 && (!aiResult.process?.inputInstances?.length || allInputsZero);
    
    if (shouldUseExtracted) {
        console.log(`[Food] Will use extracted ingredients (AI had ${aiResult.process?.inputInstances?.length ?? 0} inputs, all zero: ${allInputsZero})`);
        aiResult.process = aiResult.process || { type: 'blending', inputInstances: [] };
        const withPercent = extractedIngredients.filter(i => typeof i.percent === 'number');
        const withoutPercent = extractedIngredients.filter(i => typeof i.percent !== 'number');
        const knownPercentTotal = withPercent.reduce((s, i) => s + (i.percent || 0), 0);
        
        console.log(`[Food] Using extracted ingredients: ${withPercent.length} with %, ${withoutPercent.length} without %`);
        
        aiResult.process.inputInstances = extractedIngredients.map((ing) => {
            let grams = 0;
            if (typeof ing.percent === 'number' && totalGrams) {
                grams = Math.round((totalGrams * ing.percent) / 100);
            }
            return {
                instance: { type: ing.name, category: 'ingredient' },
                quantity: grams
            };
        });
        
        if (totalGrams && withoutPercent.length > 0 && knownPercentTotal < 100) {
            const usedGrams = aiResult.process.inputInstances.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
            const availableForDistribution = totalGrams - usedGrams;
            const perIngredient = Math.floor(availableForDistribution / withoutPercent.length);
            console.log(`[Food] Distributing ${availableForDistribution}g among ${withoutPercent.length} ingredients (~${perIngredient}g each)`);
            
            for (const input of aiResult.process.inputInstances) {
                if (input.quantity === 0) {
                    input.quantity = perIngredient;
                }
            }
        }
        
        if (totalGrams && knownPercentTotal > 0 && knownPercentTotal < 100 && withPercent.length > 0) {
            const remainder = Math.max(0, totalGrams - aiResult.process.inputInstances.reduce((s: number, i: any) => s + (i.quantity || 0), 0));
            const water = aiResult.process.inputInstances.find((i: any) => {
                const n = (i?.instance?.type || i?.instance?.name || '').toLowerCase();
                return n.includes('water') || n.includes('víz');
            });
            if (water && remainder > 0) {
                console.log(`[Food] Adding ${remainder}g remainder to water`);
                water.quantity = (water.quantity || 0) + remainder;
            }
        }
        if (!aiResult.description) {
            const names = extractedIngredients.map((i) => i.name).join(', ');
            aiResult.description = `Ingredients extracted from source: ${names}`;
        }
    }

    if (aiResult?.process?.inputInstances) {
        normalizeInputQuantitiesToGrams(aiResult.process.inputInstances, totalGrams);
    }

    if (totalGrams && aiResult?.process?.inputInstances) {
        const sum = aiResult.process.inputInstances.reduce((s: number, i: any) => s + (Number(i?.quantity) || 0), 0);
        const remaining = Math.max(0, totalGrams - sum);
        const text = `${aiResult.type || ''} ${aiResult.description || ''} ${query}`.toLowerCase();
        const waterLikely = ['water', 'liquid', 'drink', 'beverage', 'soup', 'broth', 'juice', 'cleaner', 'detergent', 'vinegar', 'spray']
            .some((k) => text.includes(k));
        if (remaining > 0 && waterLikely) {
            const water = aiResult.process.inputInstances.find((i: any) => {
                const n = (i?.instance?.type || i?.instance?.name || '').toLowerCase();
                return n.includes('water') || n.includes('víz');
            });
            if (water) {
                water.quantity = (water.quantity || 0) + remaining;
            } else {
                aiResult.process.inputInstances.push({
                    instance: { type: 'Water', category: 'ingredient' },
                    quantity: remaining
                });
            }
        }
    }
    
    if (aiResult && aiResult.process) {
        normalizeProcessTypes(aiResult, rankedProcessTypes.length? rankedProcessTypes : validProcessTypes);
    }
    return aiResult;
}
