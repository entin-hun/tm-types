
import { getAIKeys, runExtraction } from './ai-service.js';

interface SuggestionParams {
    query?: string;
    category?: string;
    type?: string;
    quantity?: number;
}

// Basic Emission Factors (kgCO2e per kg) for rough estimation
const MATERIALS_EF: Record<string, number> = {
    "vinegar": 0.5, "water": 0.001, "essential oils": 10.0, "glass": 1.2,
    "plastic": 2.5, "hdpe": 2.2, "pp": 2.0, "ldpe": 2.1, "pet": 2.8,
    "surfactants": 2.5, "solvents": 3.0, "fragrance": 5.0,
    "steel": 2.5, "stainless steel": 4.5, "aluminum": 12.0,
    "cardboard": 0.9, "paper": 1.1, "cotton": 12.0, "beeswax": 0.5,
    "hemp": 4.0, "bamboo": 3.0, "sap": 3.5, "pulp": 1.0, "oil": 3.0,
    "spent grain": 0.1, "flour": 0.8, "wheat": 0.8, "vegetable oil": 1.5, "sugar": 0.5,
    "additives": 3.0, "lithium": 15.0, "cobalt": 20.0, "copper": 4.0, "gold": 20000.0,
    "silicon": 30.0, "pcb": 25.0, "display": 50.0
};

// Minimal mapping from Ademe Impact CO2 (approximate kgCO2e per unit)
const IMPACT_CO2_DATA: Record<string, number> = {
    "jeans": 23.0,
    "t-shirt": 5.2,
    "coat": 89.0,
    "shoes": 15.0,
    "sofa": 350.0,
    "table": 75.0,
    "chair": 25.0,
    "bed": 200.0,
    "smartphone": 30.0,
    "laptop": 150.0,
    "tv": 350.0,
    "washing machine": 400.0,
    "refrigerator": 350.0
};

export async function suggestNonFood(params: SuggestionParams, userKeys?: any) {
    const p = params;
    const query = (p.query || "").toLowerCase();
    
    // Check if electronics (Boavizta)
    if (isElectronics(query)) {
        return await suggestElectronics(query);
    }

    // Default: Check static map
    const match = Object.keys(IMPACT_CO2_DATA).find(k => query.includes(k));
    if (match) {
        return {
            category: "consumer_goods",
            name: match.charAt(0).toUpperCase() + match.slice(1),
            carbon_footprint: IMPACT_CO2_DATA[match],
            unit: "kgCO2e",
            source: "ADEME Impact CO2",
            details: {
                comment: "Average data from ADEME Impact CO2 dataset",
                link: "https://impactco2.fr/"
            }
        };
    }

    // Fallback: Return generic unknown
    return {
        category: "unknown",
        name: params.query,
        carbon_footprint: null,
        message: "No specific LCA data found for this non-food item."
    };
}

export async function decomposeNonFood(params: SuggestionParams, userKeys?: any, preferredProvider?: string) {
    // For decomposition, we use the AI model to break down the product structure
    // This is similar to runExtraction but focused on BOM (Bill of Materials)
    
    const query = params.query || "unknown product";
    
    // Construct a specific prompt for decomposition
    const prompt = `
You are an expert in product manufacturing strings and Bill of Materials (BOM).
Decompose the following non-food product into its likely material components and manufacturing processes.
Product: "${query}"

Return a JSON structure compliant with this interface:
{
  "category": "category_name", 
  "name": "${query}", 
  "process": {
      "type": "manufacturing",
      "name": "Production of ${query}",
      "inputInstances": [
         { 
           "type": "local", 
           "quantity": 0.5, 
           "instance": { "name": "Material 1", "category": "material", "type": "material", "bio": false } 
         }
      ]
  }
}
Estimate weights (summing to ~1kg or appropriate unit weight) and materials (e.g. steel, plastic, glass, cotton, wood).
Keep it simple but realistic.
`;

    const req = {
        text: prompt
    };
    
    // Re-use runExtraction logic but we need to bypass the prompt wrapping somewhat, 
    // OR we just use runExtraction's existing "Extract structured product" capability if we pass the prompt as text.
    // However, runExtraction wraps the prompt. 
    
    const keys = { ...getAIKeys(), ...userKeys };
    const aiPrompt = prompt;
    
    console.error('[decompose] Keys available:', { 
        hasGroq: !!keys.groqKey, 
        hasOpenRouter: !!keys.openRouterKey, 
        hasGemini: !!keys.geminiKey,
        preferredProvider 
    });
    
    try {
        // Check preferred provider first if specified
        if (preferredProvider?.includes('gemini') && keys.geminiKey) {
            const modelName = keys.modelName && keys.modelName.startsWith('gemini') 
                ? keys.modelName 
                : 'gemini-1.5-flash';
            const modelPath = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
            console.error(`[decompose] Using Gemini model ${modelPath} for decomposition (preferred)`);
            const res = await fetch(`https://generativelanguage.googleapis.com/v1/${modelPath}:generateContent?key=${keys.geminiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: aiPrompt }] }],
                    generationConfig: { temperature: 0.1 }
                })
            });
            if (res.ok) {
                const data: any = await res.json();
                const content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
                console.error('[decompose] Gemini response:', content);
                const parsed = parseJSON(content);
                if (parsed) {
                    console.error('[decompose] Gemini succeeded');
                    return parsed;
                }
                console.error('[decompose] Gemini returned unparseable response');
            } else {
                console.error('[decompose] Gemini request failed:', res.status, await res.text());
            }
        } else if (preferredProvider?.includes('openrouter') && keys.openRouterKey) {
            console.error('[decompose] Using OpenRouter for decomposition (preferred)');
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${keys.openRouterKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'openai/gpt-4o-mini',
                    messages: [{ role: 'user', content: aiPrompt }],
                    temperature: 0.1
                })
            });
            if (res.ok) {
                const data: any = await res.json();
                const content = data.choices[0]?.message?.content;
                console.error('[decompose] OpenRouter response:', content);
                const parsed = parseJSON(content);
                if (parsed) {
                    console.error('[decompose] OpenRouter succeeded');
                    return parsed;
                }
                console.error('[decompose] OpenRouter returned unparseable response');
            } else {
                console.error('[decompose] OpenRouter request failed:', res.status, await res.text());
            }
        } else if (keys.groqKey) {
             console.error('[decompose] Using Groq for decomposition');
             const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${keys.groqKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: aiPrompt }],
                    temperature: 0.1
                })
            });
            if (res.ok) {
                const data: any = await res.json();
                const content = data.choices[0]?.message?.content;
                console.error('[decompose] Groq response:', content);
                const parsed = parseJSON(content);
                if (parsed) {
                    console.error('[decompose] Groq succeeded');
                    return parsed;
                }
                console.error('[decompose] Groq returned unparseable response');
            } else {
                console.error('[decompose] Groq request failed:', res.status, await res.text());
            }
        }
    } catch(e) {
        console.error("[decompose] Exception during AI call:", e);
    }
    
    console.error('[decompose] Falling back to static decomposition for:', query);
    // Fallback if AI fails: Static decomposition for demo
    return fallbackDecomposition(query);
}

function calculateFootprint(process: any): number {
    let cob = 0;
    if (process && process.inputInstances) {
        for (const item of process.inputInstances) {
             const key = item.instance.name.toLowerCase();
             // flexible matching
             const efKey = Object.keys(MATERIALS_EF).find(k => key.includes(k));
             const ef = efKey ? MATERIALS_EF[efKey] : 0.5; // default fallback 0.5
             cob += (item.quantity * ef);
        }
    }
    return parseFloat(cob.toFixed(2));
}

function fallbackDecomposition(query: string) {
    const q = query.toLowerCase();

    // Phones
    if (q.includes("phone")) {
        const isRefurb = q.includes("refurbished") || q.includes("second hand") || q.includes("used");
        
        const standardProcess = {
            type: "manufacturing",
            name: "Production of Smartphone",
            inputInstances: [
                 { quantity: 0.05, instance: { name: "Battery (Li-ion)", category: "component" } },
                 { quantity: 0.03, instance: { name: "Screen (OLED)", category: "component" } },
                 { quantity: 0.08, instance: { name: "PCB & Chips", category: "component" } },
                 { quantity: 0.04, instance: { name: "Aluminum Casing", category: "material" } }
            ]
        };
        
        const refurbProcess = {
            type: "refurbishment",
            name: "Refurbishment of Smartphone",
            inputInstances: [
                 { quantity: 0.05, instance: { name: "Battery (Li-ion)", category: "component" } },
                 // Keep mostly existing parts
                 { quantity: 0.01, instance: { name: "Packaging", category: "packaging" } }
            ]
        };

        const stdCO2 = calculateFootprint(standardProcess); // ~ 4.2 kg (material only, likely underestimated for electronics, boavizta is better)
        // Adjust footprint for electronics as materials method is weak here
        const realStdCO2 = 55.0; // Overwrite with Boavizta-like total
        const realRefurbCO2 = 10.0; // spare parts + logistics

        const isBetter = isRefurb;
        const selectedProcess = isBetter ? refurbProcess : standardProcess;
        const baselineCO2 = realStdCO2;
        const selectedCO2 = isBetter ? realRefurbCO2 : realStdCO2;

        return {
            name: query,
            category: "electronics",
            process: selectedProcess,
            comparison: {
                co2_item: selectedCO2,
                co2_baseline: baselineCO2,
                co2_saved: Math.max(0, baselineCO2 - selectedCO2),
                baseline_name: "New Smartphone"
            },
            source: "Boavizta (Estimate)"
        };
    }

    // Cleaning Products
    if (q.includes("cleaner") || q.includes("detergent") || q.includes("soap")) {
        const isEco = q.includes("vinegar") || q.includes("natural") || q.includes("biodegradable");
        
        const ecoProcess = {
            type: "mixing",
            name: "Production of Eco Cleaner",
            inputInstances: [
                { quantity: 0.5, instance: { name: "Vinegar", category: "ingredient" } },
                { quantity: 0.45, instance: { name: "Water", category: "ingredient" } },
                { quantity: 0.05, instance: { name: "Essential Oils", category: "ingredient" } },
                { quantity: 0.4, instance: { name: "Glass Bottle", category: "packaging" } }
            ]
        };

        const stdProcess = {
            type: "mixing",
            name: "Production of Chemical Cleaner",
            inputInstances: [
                { quantity: 0.8, instance: { name: "Water", category: "ingredient" } },
                { quantity: 0.1, instance: { name: "Surfactants (Petrochemical)", category: "ingredient" } },
                { quantity: 0.05, instance: { name: "Solvents", category: "ingredient" } },
                { quantity: 0.05, instance: { name: "Fragrance/Dye", category: "ingredient" } },
                { quantity: 0.06, instance: { name: "Plastic Bottle (HDPE)", category: "packaging" } }
            ]
        };
        
        const ecoCO2 = calculateFootprint(ecoProcess);
        const stdCO2 = calculateFootprint(stdProcess);
        
        const selectedProcess = isEco ? ecoProcess : stdProcess;
        const baselineCO2 = stdCO2;
        const selectedCO2 = isEco ? ecoCO2 : stdCO2;

        return {
            name: query,
            category: "cleaning_products",
            process: selectedProcess,
            comparison: {
                co2_item: selectedCO2,
                co2_baseline: baselineCO2,
                co2_saved: Math.max(0, baselineCO2 - selectedCO2),
                baseline_name: "Standard Chemical Cleaner"
            },
            source: "LCA Methodology (Estimate)"
        };
    }

    // Razors
    if (q.includes("razor")) {
        const isReusable = q.includes("metal") || q.includes("reusable") || q.includes("durable");
        
        const ecoProcess = {
            type: "manufacturing",
            name: "Production of Metal Razor",
            inputInstances: [
                { quantity: 0.08, instance: { name: "Stainless Steel Handle", category: "material" } },
                { quantity: 0.005, instance: { name: "Steel Blade", category: "component" } },
                { quantity: 0.01, instance: { name: "Cardboard Box", category: "packaging" } }
            ]
        };
        
        const stdProcess = {
            type: "manufacturing",
            name: "Production of Disposable Razor",
            inputInstances: [
                { quantity: 0.02, instance: { name: "Plastic Handle (PP)", category: "material" } },
                { quantity: 0.005, instance: { name: "Steel Blade", category: "component" } },
                { quantity: 0.005, instance: { name: "Lubricating Strip", category: "material" } },
                { quantity: 0.05, instance: { name: "Plastic Blister Pack", category: "packaging" } }
            ]
        };
        
        const ecoCO2 = calculateFootprint(ecoProcess);
        const stdCO2 = calculateFootprint(stdProcess);
        
        const selectedProcess = isReusable ? ecoProcess : stdProcess;
        const baselineCO2 = stdCO2 * (isReusable ? 20 : 1); // Comparing 1 metal razor to 20 disposables
        const selectedCO2 = ecoCO2; 
        
        const realBaseline = isReusable ? (stdCO2 * 20) : stdCO2;
        const realSelected = isReusable ? ecoCO2 : stdCO2;

        return {
            name: query,
            category: "hygiene",
            process: selectedProcess,
            comparison: {
                co2_item: realSelected,
                co2_baseline: realBaseline,
                co2_saved: Math.max(0, realBaseline - realSelected),
                baseline_name: isReusable ? "20 Disposable Razors (Lifetime eq)" : "Disposable Razor"
            },
            source: "LCA Methodology (Estimate)"
        };
    }

    // Wraps (Beeswax vs Plastic)
    if (q.includes("wrap") || q.includes("film")) {
        const isEco = q.includes("beeswax") || q.includes("fabric") || q.includes("washable");
        
        const ecoProcess = {
            type: "manufacturing",
            name: "Production of Beeswax Wrap",
            inputInstances: [
                { quantity: 0.02, instance: { name: "Cotton Fabric", category: "material" } },
                { quantity: 0.01, instance: { name: "Beeswax", category: "material" } },
                { quantity: 0.005, instance: { name: "Jojoba Oil", category: "material" } }
            ]
        };

        const stdProcess = {
            type: "manufacturing",
            name: "Production of Plastic Film",
            inputInstances: [
                { quantity: 0.005, instance: { name: "LDPE Plastic Film", category: "material" } },
                { quantity: 0.002, instance: { name: "Paper Box", category: "packaging" } }
            ]
        };
        
        const ecoCO2 = calculateFootprint(ecoProcess);
        const stdCO2 = calculateFootprint(stdProcess);
        
        const usageFactor = 50; 
        
        const selectedProcess = isEco ? ecoProcess : stdProcess;
        const baselineCO2 = isEco ? (stdCO2 * usageFactor) : stdCO2;
        const selectedCO2 = isEco ? ecoCO2 : stdCO2;

        return {
            name: query,
            category: "kitchen_supplies",
            process: selectedProcess,
            comparison: {
                co2_item: selectedCO2,
                co2_baseline: baselineCO2,
                co2_saved: Math.max(0, baselineCO2 - selectedCO2),
                baseline_name: isEco ? "Plastic Cling Film (Yearly supply)" : "Plastic Cling Film"
            },
            source: "LCA Methodology (Estimate)"
        };
    }

    // Diapers
    if (q.includes("diaper") || q.includes("nappy")) {
        const isEco = q.includes("fabric") || q.includes("reusable") || q.includes("cloth");
        
        const ecoProcess = {
            type: "manufacturing",
            name: "Production of Cloth Diaper",
            inputInstances: [
                { quantity: 0.15, instance: { name: "Cotton Fabric", category: "material" } },
                { quantity: 0.05, instance: { name: "Hemp/Bamboo Insert", category: "material" } }
            ]
        };

        const stdProcess = {
            type: "manufacturing",
            name: "Production of Disposable Diaper",
            inputInstances: [
                { quantity: 0.04, instance: { name: "Cellulose Pulp", category: "material" } },
                { quantity: 0.015, instance: { name: "Super Absorbent Polymer (SAP)", category: "material" } },
                { quantity: 0.02, instance: { name: "Polypropylene Non-woven", category: "material" } },
                { quantity: 0.01, instance: { name: "LDPE Backsheet", category: "material" } }
            ]
        };

        const ecoCO2 = calculateFootprint(ecoProcess);
        const stdCO2 = calculateFootprint(stdProcess);
        
        const selectedProcess = isEco ? ecoProcess : stdProcess;
        const baselineCO2 = isEco ? (stdCO2 * 200) : stdCO2; 
        const selectedCO2 = isEco ? ecoCO2 : stdCO2;

        return {
            name: query,
            category: "hygiene",
            process: selectedProcess,
            comparison: {
                co2_item: selectedCO2,
                co2_baseline: baselineCO2,
                co2_saved: Math.max(0, baselineCO2 - selectedCO2),
                baseline_name: "Disposable Diapers (Life equivalent)"
            },
            source: "Ademe Base Carbone (proxy)"
        };
    }

    // Handkerchiefs
    if (q.includes("hanky") || q.includes("handkerchief")) {
        const isEco = q.includes("fabric") || q.includes("reusable") || q.includes("cloth");
        
        const ecoProcess = {
            type: "manufacturing",
            name: "Production of Cloth Handkerchief",
            inputInstances: [
                { quantity: 0.03, instance: { name: "Cotton Fabric", category: "material" } }
            ]
        };
        
        const stdProcess = {
            type: "manufacturing",
            name: "Production of Paper Tissue",
            inputInstances: [
                { quantity: 0.005, instance: { name: "Paper Tissue (Virgin Pulp)", category: "material" } },
                { quantity: 0.001, instance: { name: "Plastic Pack", category: "packaging" } }
            ]
        };
        
        const ecoCO2 = calculateFootprint(ecoProcess);
        const stdCO2 = calculateFootprint(stdProcess);
        
        const selectedProcess = isEco ? ecoProcess : stdProcess;
        const baselineCO2 = isEco ? (stdCO2 * 500) : stdCO2;
        const selectedCO2 = isEco ? ecoCO2 : stdCO2;

        return {
            name: query,
            category: "textiles",
            process: selectedProcess,
            comparison: {
                co2_item: selectedCO2,
                co2_baseline: baselineCO2,
                co2_saved: Math.max(0, baselineCO2 - selectedCO2),
                baseline_name: "Paper Tissues (Lifetime usage)"
            },
            source: "Ademe Base Carbone (proxy)"
        };
    }

     // Crackers
    if (q.includes("cracker") || q.includes("biscuit")) {
        const isEco = q.includes("rescued") || q.includes("recycled") || q.includes("spent grain");
        
        const ecoProcess = {
            type: "baking",
            name: "Production of Spent Grain Crackers",
            inputInstances: [
                { quantity: 0.4, instance: { name: "Spent Grain (Brewer's Byproduct)", category: "ingredient" } },
                { quantity: 0.4, instance: { name: "Wheat Flour", category: "ingredient" } },
                { quantity: 0.1, instance: { name: "Vegetable Oil", category: "ingredient" } },
                { quantity: 0.1, instance: { name: "Water", category: "ingredient" } }
            ]
        };
        
        const stdProcess = {
            type: "baking",
            name: "Production of Wheat Crackers",
            inputInstances: [
                { quantity: 0.7, instance: { name: "Refined Wheat Flour", category: "ingredient" } },
                { quantity: 0.15, instance: { name: "Palm Oil", category: "ingredient" } },
                { quantity: 0.05, instance: { name: "Sugar", category: "ingredient" } },
                { quantity: 0.05, instance: { name: "Additives/Preservatives", category: "ingredient" } },
                { quantity: 0.05, instance: { name: "Plastic Wrapper", category: "packaging" } }
            ]
        };
        
        const ecoCO2 = calculateFootprint(ecoProcess);
        const stdCO2 = calculateFootprint(stdProcess);
        
        const selectedProcess = isEco ? ecoProcess : stdProcess;
        const baselineCO2 = stdCO2;
        const selectedCO2 = isEco ? ecoCO2 : stdCO2;

        return {
            name: query,
            category: "food_product",
            process: selectedProcess,
            comparison: {
                co2_item: selectedCO2,
                co2_baseline: baselineCO2,
                co2_saved: Math.max(0, baselineCO2 - selectedCO2),
                baseline_name: "Standard Wheat Crackers"
            },
            source: "Food Waste LCA Studies (Estimate)"
        };
    }

    // Generic fallback for truly unknown products
    return {
        name: query,
        category: "unknown",
        inputInstances: [
            { type: "local", quantity: 0.5, instance: { name: "Materials", category: "material" } },
            { type: "local", quantity: 0.3, instance: { name: "Packaging", category: "packaging" } },
            { type: "local", quantity: 0.2, instance: { name: "Energy", category: "energy" } }
        ]
    };
}

function isElectronics(query: string) {
    const list = ['phone', 'laptop', 'server', 'computer', 'screen', 'tv', 'tablet', 'watch'];
    return list.some(k => query.includes(k));
}

async function suggestElectronics(query: string) {
    let co2 = 0;
    let deviceType = "unknown";

    if (query.includes("laptop")) { co2 = 250; deviceType = "laptop"; }
    else if (query.includes("server")) { co2 = 1200; deviceType = "server"; }
    else if (query.includes("phone") || query.includes("smart")) { co2 = 55; deviceType = "smartphone"; }
    else if (query.includes("tablet")) { co2 = 80; deviceType = "tablet"; }
    
    return {
        category: "electronics",
        name: query,
        carbon_footprint: co2,
        unit: "kgCO2e",
        source: "Boavizta (Estimated)",
        details: {
            device_type: deviceType,
            lifetime_years: 4,
            use_phase_share: 0.15, 
            manufacturing_share: 0.85,
            link: "https://boavizta.org/"
        }
    };
}

function parseJSON(text: string) {
    if(!text) return null;
    try {
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(clean);
    } catch (e) { return null; }
}
