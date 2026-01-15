# openLCA MCP Enricher Specification

## Overview

This MCP enricher sits between Trace Market product/process requests and the gdt-server (openLCA) backend at `https://lca.trace.market`. It validates, enriches, and translates incoming requests into openLCA calculation jobs, returning standardized LCIA results.

## Architecture

```
POST /estimate (incoming request)
    ↓
MCP Enricher
├─ Validate contract (required fields)
├─ Enrich defaults (EF 3.1, primary DB, unit conversions)
├─ Fuzzy-match process if name-based
├─ Build product system in openLCA
    ↓
gdt-server /api/calculate
    ↓
LCIA Results → Normalize & return
```

## Database Configuration

### Primary Database (Default)
- **BAFU-2025_LCI_DB_17Dec25** (11,747 processes)
  - Swiss/EU focus, textile/agriculture/construction processes
  - Strong for smallholder farms and construction materials
  - Geographic: CH, EU
  
### Secondary Databases (Fallback/Sector-Specific)
- **exiobase3_monetary_20181212_fixedlcia_July2021** (7,504 processes)
  - Global input-output LCA, comprehensive sectors
  - Fallback for non-EU/non-Swiss processes
  
- **usda_1901009** (8,434 processes)
  - US agriculture and food systems
  - Use if location=USA or sector=agriculture

- **ELCD** (365 processes)
  - European reference processes (energy, materials)
  - High-quality peer-reviewed data

### LCIA Method
- **Default: EF v3.1** (UUID: `20629e27-b863-4fbe-bbc2-082d3eefd1e5`)
  - From: `ecoinvent 3.12 LCIA Methods 2025-12-01`
  - 16 impact categories (climate, water, toxicity, eutrophication, etc.)
  - Suitable for EU supply chains and international LCA standards

---

## Request Contract (JSON Schema)

### POST /api/estimate/impacts

**Minimal Required Fields:**
```typescript
{
  "processName": string,           // e.g., "cotton fabric production"
  "amount": number,                 // numeric quantity
  "unit": string,                   // e.g., "kg", "m2", "kWh"
  "flowType": string,               // "product" | "material" | "energy" | "service"
  
  // Optional (auto-filled with defaults if missing)
  "database": string,               // default: "BAFU-2025_LCI_DB_17Dec25"
  "lciaMethod": string,             // default: "EF v3.1"
  "location": string,               // e.g., "CH", "EU", "USA"; helps process match
  "systemBoundary": string,         // "cradle-to-gate" (default) | "cradle-to-grave" | "gate-to-gate"
  "allocation": string,             // "cut-off" (default) | "system-expansion" | "economic" | "mass"
  
  // Optional: pre-validated
  "processUUID": string,            // if known, skip fuzzy match
  "referenceFlowUnit": string,      // if known, helps conversion
}
```

### Response: Impacts

```typescript
{
  "status": "success" | "partial_match" | "needs_clarification",
  
  // If success
  "results": {
    "processMatched": {
      "uuid": string,
      "name": string,
      "database": string,
      "location": string,
      "referenceFlow": { name: string, unit: string, amount: number }
    },
    "lcia": {
      "method": "EF v3.1",
      "impacts": [
        {
          "category": "Climate change",
          "value": 2.45,
          "unit": "kg CO2-Eq",
          "description": "GWP100, includes fossil + biogenic + LULUC"
        },
        {
          "category": "Water use",
          "value": 0.082,
          "unit": "m3 world Eq deprived"
        },
        {
          "category": "Acidification",
          "value": 0.0015,
          "unit": "mol H+-Eq"
        },
        {
          "category": "Eutrophication: terrestrial",
          "value": 0.0082,
          "unit": "mol N-Eq"
        },
        {
          "category": "Human toxicity: carcinogenic",
          "value": 1.2e-6,
          "unit": "CTUh"
        },
        {
          "category": "Land use",
          "value": 0.0042,
          "unit": "dimensionless"
        }
      ],
      "normalised": {
        "totalScore": 0.0234, // weighted sum of normalized impacts
        "unit": "Pts (EF 3.1 Global Reference 2010)"
      }
    },
    "requestMatched": {
      "processName": "Cotton fabric production (conventional)",
      "amount": 1,
      "unit": "m2",
      "amountScaled": 0.5,  // If ref flow was 2 m2, scale results
      "scaleFactor": 0.5
    },
    "metadata": {
      "calculationTime": "245ms",
      "database": "BAFU-2025_LCI_DB_17Dec25",
      "timestamp": "2026-01-07T14:32:00Z"
    }
  },
  
  // If partial_match or needs_clarification
  "clarifications": {
    "processMatches": [
      {
        "rank": 1,
        "match": "Cotton fabric production, bleached",
        "uuid": "...",
        "similarity": 0.92,
        "location": "CH",
        "referenceFlow": { name: "Cotton fabric", unit: "m2", amount: 1 }
      },
      {
        "rank": 2,
        "match": "Cotton fabric, conventional, mixed origins",
        "uuid": "...",
        "similarity": 0.87,
        "location": "EU",
        "referenceFlow": { name: "Cotton fabric", unit: "m2", amount: 1 }
      }
    ],
    "message": "Multiple process matches found. Confirm: did you mean 'Cotton fabric production, bleached (CH)'?"
  }
}
```

---

## Enrichment Logic

### 1. Database Selection
```python
def select_database(location: str, sector: str, user_db_hint: str = None) -> str:
  if user_db_hint:
    return validate_db(user_db_hint)
  
  if location in ["USA", "US"]:
    return "usda_1901009"  # USDA agriculture
  elif location in ["CH", "EU", "DE", "FR", "AT"]:
    return "BAFU-2025_LCI_DB_17Dec25"  # Swiss/EU
  elif sector in ["agriculture", "food"]:
    return "exiobase3_monetary_20181212_fixedlcia_July2021"  # Global IO
  else:
    return "BAFU-2025_LCI_DB_17Dec25"  # Default
```

### 2. Process Matching
```python
def match_process(name: str, unit: str, database: str, location: str = None) -> (uuid, score):
  # Fuzzy match against /database/processes/<uuid>.json
  candidates = []
  
  for process_file in database.processes:
    process_name = process_file.name
    similarity = levenshtein_ratio(name.lower(), process_name.lower())
    
    # Boost score if location matches
    if location and process_file.location == location:
      similarity *= 1.15
    
    # Boost if unit matches reference flow
    if unit == process_file.referenceFlowUnit:
      similarity *= 1.10
    
    if similarity > 0.7:
      candidates.append((process_file.uuid, process_file, similarity))
  
  return sorted(candidates, key=lambda x: x[2], reverse=True)[:3]
```

### 3. Unit Normalization
```python
UNIT_CONVERSIONS = {
  "g": { "kg": 0.001, "t": 1e-6 },
  "kg": { "g": 1000, "t": 0.001 },
  "m2": { "m2": 1.0 },  # no conversion needed
  "kWh": { "MJ": 3.6, "J": 3.6e6 },
  "MJ": { "kWh": 0.2778, "J": 1e6 },
}

def normalize_to_reference_flow(amount: float, user_unit: str, ref_unit: str) -> float:
  if user_unit == ref_unit:
    return amount
  
  if user_unit in UNIT_CONVERSIONS and ref_unit in UNIT_CONVERSIONS[user_unit]:
    return amount * UNIT_CONVERSIONS[user_unit][ref_unit]
  
  raise ValueError(f"Cannot convert {user_unit} to {ref_unit}")
```

### 4. LCIA Method Selection
```python
def select_lcia_method(user_method: str = None) -> str:
  if user_method == "EF 3.0":
    return "1a653397-a909-4c2c-80d7-186462c20889"
  elif user_method == "EF 3.1" or user_method is None:  # default
    return "20629e27-b863-4fbe-bbc2-082d3eefd1e5"
  else:
    raise ValueError(f"LCIA method {user_method} not supported")
```

### 5. System Boundary Defaults
```python
SYSTEM_BOUNDARIES = {
  "agriculture": "cradle-to-gate",      # field to farm gate
  "textiles": "cradle-to-gate",         # fiber to fabric
  "construction": "cradle-to-site",     # material production + transport to site
  "energy": "gate-to-gate",             # electricity generation only
  "default": "cradle-to-gate"
}
```

---

## Required Input Fields for Impact Estimate

### Critical (Must Have)
1. **`processName`** – What product/process? (e.g., "cotton fabric", "brick production", "milk")
   - *Reason*: Uniquely identifies the LCA model; without it, no calculation possible.

2. **`amount`** – How much? (numeric only)
   - *Reason*: LCA is flow-based; need quantity to scale results.

3. **`unit`** – In what unit? (e.g., "kg", "m2", "kWh", "liter")
   - *Reason*: Ensures correct dimensional scaling and unit conversion to reference flow.

4. **`flowType`** – Category hint: "product" | "material" | "energy" | "service"
   - *Reason*: Helps database/process selector (e.g., "energy" → exiobase energy sector).

### Recommended (Auto-Fill Defaults)
5. **`location`** – Geographic context (e.g., "CH", "EU", "USA", "IN")
   - *Auto-default*: If missing, assume "EU"
   - *Reason*: Selects region-appropriate processes (US agriculture vs. EU textiles).

6. **`systemBoundary`** – LCA scope (cradle-to-gate / cradle-to-grave / gate-to-gate)
   - *Auto-default*: "cradle-to-gate"
   - *Reason*: Defines what life cycle stages to include; most supply chains stop at delivery ("cradle-to-gate").

7. **`allocation`** – How to handle co-products (cut-off / system-expansion / economic / mass)
   - *Auto-default*: "cut-off"
   - *Reason*: Standard for multi-output processes.

### Optional (Expert/Advanced)
8. **`database`** – Which LCA DB? (BAFU-2025_LCI_DB_17Dec25, exiobase3, usda_1901009, etc.)
   - *Auto-default*: Selected by enricher based on location + sector.
   - *Reason*: Expert users may want specific DB; enricher recommends intelligently.

9. **`lciaMethod`** – Which impact assessment? (EF 3.1, EF 3.0, ReCiPe, TRACI, CML)
   - *Auto-default*: "EF 3.1"
   - *Reason*: EF 3.1 is EU standard & latest; user can override.

10. **`processUUID`** – Skip fuzzy match, use exact process UUID
    - *Auto-default*: None; enricher performs fuzzy match.
    - *Reason*: For known/cached process IDs; speeds up repeated calls.

---

## Minimum tm-types Input Mapping

From the existing tm-types ProductInstance/Process model:

```typescript
// Trace Market Process Input
{
  type: "Process",
  name: "Cotton dyeing",
  quantity: 500,
  unit: "kg",
  location: "India",
  category: "Textiles",
  inputs: [
    { type: "Material", name: "cotton fabric", quantity: 500, unit: "kg" },
    { type: "Chemical", name: "dye", quantity: 5, unit: "kg" }
  ],
  outputs: [
    { type: "Product", name: "dyed cotton fabric", quantity: 500, unit: "kg" }
  ]
}

// → Enriched to openLCA Estimate Request
{
  processName: "Cotton dyeing",
  amount: 500,
  unit: "kg",
  flowType: "product",
  location: "IN",  // mapped from India
  systemBoundary: "cradle-to-gate",
  allocation: "cut-off",
  // database & lciaMethod filled by enricher
}

// → Result
{
  "status": "success",
  "results": {
    "lcia": {
      "method": "EF v3.1",
      "impacts": [
        { "category": "Climate change", "value": 625.0, "unit": "kg CO2-Eq" },
        { "category": "Water use", "value": 41.0, "unit": "m3 world Eq deprived" },
        ...
      ]
    }
  }
}
```

---

## MCP Enricher Endpoints

### 1. GET /api/databases
List available databases and their process/method coverage.
```json
{
  "databases": [
    {
      "id": "BAFU-2025_LCI_DB_17Dec25",
      "name": "BAFU 2025 LCI Database",
      "version": "17 Dec 2025",
      "processCount": 11747,
      "geographic": ["CH", "EU"],
      "sectors": ["textiles", "agriculture", "construction", "energy", ...],
      "lciaMethods": ["EF 3.1", "EF 3.0", "ReCiPe", ...]
    },
    ...
  ]
}
```

### 2. POST /api/estimate/impacts
Calculate LCIA for a product/process.
- **Request**: See above schema.
- **Response**: Impacts + clarifications.

### 3. POST /api/estimate/processes/search
Fuzzy-search processes in a database.
```json
{
  "query": "cotton fabric",
  "database": "BAFU-2025_LCI_DB_17Dec25",
  "limit": 5,
  "location": "CH"
}
```
**Response**: Top 5 matching processes with UUIDs & similarity scores.

### 4. GET /api/lcia-methods
List available LCIA methods.
```json
{
  "methods": [
    {
      "id": "20629e27-b863-4fbe-bbc2-082d3eefd1e5",
      "name": "EF v3.1",
      "impactCategories": 16,
      "database": "ecoinvent 3.12 LCIA Methods 2025-12-01"
    },
    ...
  ]
}
```

---

## Next Steps

1. **Validate with sample estimate**: Send a cotton fabric request; confirm BAFU DB returns process, scales to EF 3.1, returns 6–8 impact categories.
2. **Integrate into tm-types**: Map ProductInstance → enricher request; store results in Impact object.
3. **Cache DB metadata**: Pre-load process indexes (names, UUIDs, units) so fuzzy-match is <100ms.
4. **Test fallback logic**: If BAFU fails, ensure exiobase3 is tried.

