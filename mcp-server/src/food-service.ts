
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
                    const keywords = ['ingredients', 'composition'];
                    const lowerBody = cleanBody.toLowerCase();
                    const match = keywords.find(k => lowerBody.includes(k));
                    if (match) {
                        const ingrIndex = lowerBody.lastIndexOf(match);
                        const start = Math.max(0, ingrIndex);
                        textExtract = cleanBody.slice(start, start + 7000);
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

Task: Construct a "Product Instance" JSON object.
Rules:
1. Root is product.
2. 'process.type' strictly one of: [${validProcessTypes.map(t => `'${t}'`).join(', ')}].
3. Exclude 'harvest'/'sale' unless explicit.
4. Input instances from Context or candidates.
5. Quantity: real usage for parents, 0 if unknown (never 1000 default).
6. Price: Strictly empty.
7. IDs: Use candidates if matching.
Output JSON only.
`;
     
    let aiResult = null;
    const activeKey = keys.groqKey || keys.openRouterKey || keys.geminiKey;
    
    if (activeKey) {
        try {
             const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${activeKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1
                })
            });
            if(res.ok) {
                const data: any = await res.json();
                const content = data.choices[0]?.message?.content;
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
    
    if (aiResult && aiResult.process) {
        normalizeProcessTypes(aiResult, rankedProcessTypes.length? rankedProcessTypes : validProcessTypes);
    }
    return aiResult;
}
