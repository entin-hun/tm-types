/**
 * OpenLCA MCP Enricher - Type Definitions
 * 
 * This module defines the request/response contracts for the openLCA MCP enricher
 * that sits between Trace Market supply chain data and the gdt-server backend.
 */

/**
 * LCIA Impact Category with value and unit
 */
export interface ImpactResult {
  category: string; // e.g., "Climate change", "Water use"
  value: number;    // e.g., 2.45
  unit: string;     // e.g., "kg CO2-Eq", "m3 world Eq deprived"
  description?: string; // e.g., "GWP100, includes fossil + biogenic + LULUC"
}

/**
 * Normalised weighted impact score (EF 3.1 style)
 */
export interface NormalisedImpact {
  totalScore: number; // 0.0–1.0 or higher, depending on normalisation
  unit: string;       // e.g., "Pts (EF 3.1 Global Reference 2010)"
}

/**
 * LCIA calculation result
 */
export interface LCIAResult {
  method: string;           // e.g., "EF v3.1"
  impacts: ImpactResult[];  // Array of 6–16 impact categories
  normalised?: NormalisedImpact; // Optional weighted score
}

/**
 * Details of the matched process in openLCA
 */
export interface ProcessMatched {
  uuid: string;
  name: string;
  database: string;
  location: string;
  referenceFlow: {
    name: string;
    unit: string;
    amount: number;
  };
}

/**
 * Describes how the request was scaled/converted to match reference flow
 */
export interface RequestMatched {
  processName: string;
  amount: number;
  unit: string;
  amountScaled: number;  // Amount after unit conversion
  scaleFactor: number;   // Multiplier applied to LCIA results
}

/**
 * Successful estimate response
 */
export interface EstimateSuccess {
  status: "success";
  results: {
    processMatched: ProcessMatched;
    lcia: LCIAResult;
    requestMatched: RequestMatched;
    metadata: {
      calculationTime: string; // e.g., "245ms"
      database: string;
      timestamp: string; // ISO 8601
    };
  };
}

/**
 * Single process match candidate
 */
export interface ProcessMatchCandidate {
  rank: number;
  match: string; // Process name
  uuid: string;
  similarity: number; // 0.0–1.0
  location: string;
  referenceFlow: {
    name: string;
    unit: string;
    amount: number;
  };
}

/**
 * Clarification response (partial match or ambiguity)
 */
export interface EstimateClarification {
  status: "partial_match" | "needs_clarification";
  clarifications: {
    processMatches: ProcessMatchCandidate[];
    message: string; // e.g., "Multiple process matches found. Confirm: did you mean..."
  };
}

/**
 * Error response
 */
export interface EstimateError {
  status: "error";
  error: {
    code: string; // e.g., "PROCESS_NOT_FOUND", "INVALID_UNIT"
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Union of all estimate response types
 */
export type EstimateResponse = EstimateSuccess | EstimateClarification | EstimateError;

/**
 * Input request for impact estimation (minimal required fields)
 */
export interface EstimateImpactRequest {
  // Required
  processName: string;  // e.g., "cotton fabric production"
  amount: number;        // Numeric quantity
  unit: string;          // e.g., "kg", "m2", "kWh"
  flowType: "product" | "material" | "energy" | "service"; // Category hint

  // Optional (auto-filled with defaults)
  database?: string; // Default: selected by enricher (e.g., "BAFU-2025_LCI_DB_17Dec25")
  lciaMethod?: string; // Default: "EF 3.1"
  location?: string; // e.g., "CH", "EU", "USA"; helps process match
  systemBoundary?: "cradle-to-gate" | "cradle-to-grave" | "gate-to-gate"; // Default: "cradle-to-gate"
  allocation?: "cut-off" | "system-expansion" | "economic" | "mass"; // Default: "cut-off"

  // Expert/Advanced
  processUUID?: string; // If known, skip fuzzy match
  referenceFlowUnit?: string; // If known, helps conversion
}

/**
 * Database metadata
 */
export interface DatabaseInfo {
  id: string;
  name: string;
  version: string;
  processCount: number;
  geographic: string[]; // e.g., ["CH", "EU", "USA"]
  sectors: string[]; // e.g., ["textiles", "agriculture", "construction"]
  lciaMethods: string[]; // e.g., ["EF 3.1", "EF 3.0", "ReCiPe"]
}

/**
 * LCIA method metadata
 */
export interface LCIAMethodInfo {
  id: string; // UUID
  name: string; // e.g., "EF v3.1"
  impactCategories: number; // e.g., 16
  database: string; // Which DB it belongs to
  description?: string;
}

/**
 * Response from GET /api/databases
 */
export interface DatabasesListResponse {
  databases: DatabaseInfo[];
}

/**
 * Response from GET /api/lcia-methods
 */
export interface LCIAMethodsListResponse {
  methods: LCIAMethodInfo[];
}

/**
 * Request for process search
 */
export interface ProcessSearchRequest {
  query: string;        // e.g., "cotton fabric"
  database: string;     // Which DB to search
  limit?: number;       // Default: 5
  location?: string;    // Optional: filter by location
}

/**
 * Process search result
 */
export interface ProcessSearchResult {
  processes: ProcessMatchCandidate[];
}

/**
 * Enricher configuration (server-side)
 */
export interface EnricherConfig {
  primaryDatabase: string; // e.g., "BAFU-2025_LCI_DB_17Dec25"
  secondaryDatabases: Record<string, string>; // e.g., { usa: "usda_1901009", eu: "BAFU-2025_LCI_DB_17Dec25" }
  defaultLCIAMethod: string; // UUID of EF 3.1
  gdtServerUrl: string; // e.g., "http://127.0.0.1:38081"
  fuzzyMatchThreshold: number; // e.g., 0.7
  unitConversions: Record<string, Record<string, number>>; // e.g., { g: { kg: 0.001 } }
}

/**
 * Helper to build an estimate request from Trace Market Process
 * 
 * Maps ProductInstance/Process → EstimateImpactRequest
 */
export function traceMarketToEstimate(
  processName: string,
  amount: number,
  unit: string,
  location?: string,
  category?: string
): EstimateImpactRequest {
  // Infer flow type from category
  let flowType: "product" | "material" | "energy" | "service" = "product";
  if (category) {
    if (category.toLowerCase().includes("energy")) flowType = "energy";
    else if (category.toLowerCase().includes("material")) flowType = "material";
    else if (category.toLowerCase().includes("service")) flowType = "service";
  }

  return {
    processName,
    amount,
    unit,
    flowType,
    location,
    // Defaults auto-filled by enricher:
    // database, lciaMethod, systemBoundary, allocation
  };
}

/**
 * Helper to extract key impacts from LCIA result
 * (e.g., for quick display in UI)
 */
export function extractKeyImpacts(
  lcia: LCIAResult,
  keys: string[] = ["Climate change", "Water use", "Land use"]
): ImpactResult[] {
  return lcia.impacts.filter(imp => keys.includes(imp.category));
}
