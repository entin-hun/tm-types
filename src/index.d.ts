import { GeoJSON } from "geojson";
export { 
  typeDescriptions, 
  getFieldDescription, 
  getTypeDescription,
  getAllTypeNames,
  getProcessIcon,
  getProcessLabel,
  hasTypeDescription
} from "./descriptions";
export type { FieldDescription, TypeDescription } from "./descriptions";

// OpenLCA MCP Enricher types
export type {
  ImpactResult,
  NormalisedImpact,
  LCIAResult,
  ProcessMatched,
  RequestMatched,
  EstimateSuccess,
  ProcessMatchCandidate,
  EstimateClarification,
  EstimateError,
  EstimateResponse,
  EstimateImpactRequest,
  DatabaseInfo,
  LCIAMethodInfo,
  DatabasesListResponse,
  LCIAMethodsListResponse,
  ProcessSearchRequest,
  ProcessSearchResult,
  EnricherConfig
} from "./openlcaMcpTypes";
export { traceMarketToEstimate, extractKeyImpacts } from "./openlcaMcpTypes";

export type TokenIdOr<T> = string | T | FetchError;

export interface FetchError {
  errorMessage: string;
}

export interface Pokedex {
  notes: string;
  roles: string;
  token: string;
  typesVersion: string;
  instance: ProductInstance;
}

export type Location = GeoJSON.Point;

export interface Facility {
  label?: string;
  location: Location;
}

export type Process =
  | PrintingProcess
  | MillingProcess
  | FreezeDryingProcess
  | BlendingProcess
  | SaleProcess
  | HarvestProcess
  | CookingProcess;

export interface GenericProcess {
  timestamp: number;
  duration?: number;
  facility?: Facility;
  temperatureRange?: TemperatureRange;
  inputInstances: (TransportedInputInstance | LocalInputInstance)[];
  impacts?: Impact[];
  price?: Price;
  hr?: Hr;
}

export interface PrintingProcess extends GenericProcess {
  type: "printing";
  toolInstance?: TokenIdOr<ToolInstance>;
  knowHow?: TokenIdOr<KnowHow>;
  shape: string /* URL */;
}

export interface MillingProcess extends GenericProcess {
  type: "milling";
  knowHow?: TokenIdOr<KnowHow>;
  toolInstance?: TokenIdOr<ToolInstance>;
}

export interface FreezeDryingProcess extends GenericProcess {
  type: "freezedrying";
  knowHow?: TokenIdOr<KnowHow>;
  toolInstance?: TokenIdOr<ToolInstance>;
}

export interface BlendingProcess extends GenericProcess {
  type: "blending";
  toolInstance?: TokenIdOr<ToolInstance>;
  knowHow?: TokenIdOr<KnowHow>;
}

export interface SaleProcess extends GenericProcess {
  type: "sale";
  price: Price;
}

export interface HarvestProcess extends GenericProcess {
  type: "harvest";
}

export interface CookingProcess extends GenericProcess {
  type: "cooking";
  method: "baking" | "boiling" | "frying" | "steaming" | "roasting" | "sous-vide" | "grilling";
  toolInstance?: TokenIdOr<ToolInstance>; // e.g. oven
  knowHow?: TokenIdOr<KnowHow>;
}

export interface Price {
  amount: number;
  currency: string;
  type: "budget" | "is" | "%" | "payin30days" | "payin60days";
}

export interface GenericInputInstance {
  instance: TokenIdOr<ProductInstance>;
  quantity: number; // g|ml
}
export interface LocalInputInstance extends GenericInputInstance {
  type: "local";
}

export interface TransportedInputInstance extends GenericInputInstance {
  type: "transported";
  transport: Transport;
}

export type InputInstance = LocalInputInstance | TransportedInputInstance;

export interface Transport {
  method: TransportMethod;
  fuelType: "hydrogen" | "electric" | "diesel" | "petrol" | "kerosene";
  weight: number;
  deparetureTime: number;
  duration: number;
}

export type TransportMethod = "air" | "sea" | "land";

export interface ProductInstanceBase {
  type: string;
  ownerId?: string;
  expiryDate?: number;
  bio: boolean;
  quantity: number;
  price?: Price;
  title?: string;
  notes?: string;
  pictureURL?: string;
}

export interface FoodInstance extends ProductInstanceBase {
  category: "food";
  iDs?: ID[];
  nutrients?: FallbackFoodNutrient[];
  format?: string;
  grade?: string;
  size?: string;
  process?: Process;
  labels?: string[]; // Flexible food attributes (e.g., "low-sugar", "keto", "organic", "fair-trade")
}

export interface NonFoodInstance extends ProductInstanceBase {
  category: "non-food";
  grade: string;
  size: string;
  labels?: string[]; // Flexible non-food attributes (e.g., "food-safe", "recyclable")
}

/** @deprecated Use NonFoodInstance instead */
export type CartridgeInstance = NonFoodInstance;

export interface PackagingInstance extends ProductInstanceBase {
  category: "packaging";
  material: string;
  labels?: string[];
}

export type ProductInstance = FoodInstance | NonFoodInstance | PackagingInstance;

export interface FallbackFoodNutrient {
  amount: number;
  iD: ID;
}

export interface ToolInstance {
  category: string;
  ownerId: string;
  quantity: number;
  size: string;
  ratedPowerKW?: number;
  providerSDomain: string;
  hash: string;
}

export interface Hr {
  tasks: string[]; // Ordered list of steps
  assignee: string;
}

export interface TemperatureRange {
  min: number;
  max: number;
}

export interface KnowHow {
  owner: string;
  hash: string;
  inputs: string; // JSONata expression
  outputs: string | object;
  licenseFee: Price;
  note?: string | object;
  logoURL?: string;
}

export interface GenericImpact {
  ownerId: string;
  format: string;
  /* x (g|l) */
  quantity: number;
}

export type Impact = CarbonImpact | WaterImpact;

export interface CarbonImpact extends GenericImpact {
  category: "carbon";
}

export interface WaterImpact extends GenericImpact {
  category: "water";
}

export interface ID {
  registry: string;
  id: string;
}
