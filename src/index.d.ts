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
  | PackagingProcess
  | StorageProcess
  | CookingProcess;

export interface GenericProcess {
  timestamp: number;
  duration?: number;
  facility?: Facility;
  temperatureRange?: TemperatureRange;
  inputInstances: (TransportedInputInstance | LocalInputInstance)[];
  impacts?: Impact[];
  price?: Price;
}

export interface PrintingProcess extends GenericProcess {
  type: "printing";
  machineInstance?: TokenIdOr<MachineInstance>;
  knowHow?: TokenIdOr<KnowHow>;
  shape: string /* URL */;
}

export interface MillingProcess extends GenericProcess {
  type: "milling";
  knowHow?: TokenIdOr<KnowHow>;
  machineInstance?: TokenIdOr<MachineInstance>;
}

export interface FreezeDryingProcess extends GenericProcess {
  type: "freezedrying";
  knowHow?: TokenIdOr<KnowHow>;
  machineInstance?: TokenIdOr<MachineInstance>;
}

export interface BlendingProcess extends GenericProcess {
  type: "blending";
  machineInstance?: TokenIdOr<MachineInstance>;
  knowHow?: TokenIdOr<KnowHow>;
}

export interface SaleProcess extends GenericProcess {
  type: "sale";
  price: Price;
}

export interface HarvestProcess extends GenericProcess {
  type: "harvest";
}

export interface PackagingProcess extends GenericProcess {
  type: "packaging";
  packaging: TokenIdOr<PackagingInstance>[];
  machineInstance?: TokenIdOr<MachineInstance>;
}

export interface StorageProcess extends GenericProcess {
  type: "storage";
  conditions: "ambient" | "refrigerated" | "frozen" | "controlled-atmosphere";
  machineInstance?: TokenIdOr<MachineInstance>; // e.g. freezer unit
}

export interface CookingProcess extends GenericProcess {
  type: "cooking";
  method: "baking" | "boiling" | "frying" | "steaming" | "roasting" | "sous-vide" | "grilling";
  temperature?: number; // C
  machineInstance?: TokenIdOr<MachineInstance>; // e.g. oven
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

export type EcoLabel =
  | "organic"
  | "fair-trade"
  | "carbon-neutral"
  | "plastic-free"
  | "bpa-free"
  | "non-gmo"
  | "recyclable"
  | "biodegradable"
  | "compostable"
  | "fsc-certified"
  | "rainforest-alliance"
  | "cruelty-free"
  | "vegan"
  | "vegetarian"
  | "gluten-free"
  | "dairy-free"
  | "local"
  | "seasonal"
  | "sustainable-sourcing"
  | "renewable-energy"
  | "zero-waste"
  | "upcycled"
  | "regenerative"
  | "b-corp"
  | "eu-ecolabel"
  | "blue-angel"
  | "energy-star"
  | "water-efficient"
  | "palm-oil-free"
  | "refined-oil-free";

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
  labels?: string[]; // Flexible food attributes (e.g., "low-sugar", "keto")
  ecoLabels?: EcoLabel[]; // Eco certifications (e.g., organic, fair-trade)
  qualityAttributes?: string[]; // Safety/quality (e.g., pesticide-free)
}

export interface NonFoodInstance extends ProductInstanceBase {
  category: "cartridge";
  grade: string;
  size: string;
  labels?: string[]; // Flexible cartridge attributes (e.g., "food-safe")
  ecoLabels?: EcoLabel[]; // Eco certifications (e.g., recyclable)
  qualityAttributes?: string[]; // Safety/quality (e.g., BPA-free, lead-free)
}

/** @deprecated Use NonFoodInstance instead */
export type CartridgeInstance = NonFoodInstance;

export interface PackagingInstance extends ProductInstanceBase {
  category: "packaging";
  material: string;
  labels?: string[];
  ecoLabels?: EcoLabel[];
  qualityAttributes?: string[];
}

export type ProductInstance = FoodInstance | NonFoodInstance | PackagingInstance;

export interface FallbackFoodNutrient {
  amount: number;
  iD: ID;
}

export interface MachineInstance {
  category: string;
  ownerId: string;
  quantity: number;
  size: string;
  ratedPowerKW?: number;
  hr: Hr;
  providerSDomain: string;
}

export interface Hr {
  tasks: string;
  assignee: string;
}

export interface TemperatureRange {
  min: number;
  max: number;
}

export interface KnowHow {
  owner: string;
  hash: string;
  inputs: string;
  outputs: string;
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
