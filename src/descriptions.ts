/**
 * Type descriptions for tooltips and MCP assistance
 * Single source of truth for field documentation across the application
 */

export interface FieldDescription {
  label: string;
  description: string;
  examples?: string[];
}

export interface TypeDescription {
  name: string;
  header: string;
  fields: Record<string, FieldDescription>;
}

export const typeDescriptions: Record<string, TypeDescription> = {
  Pokedex: {
    name: 'Pokedex',
    header: 'Complete product record with blockchain references and supply chain data',
    fields: {
      notes: {
        label: 'Notes',
        description: 'HTML-formatted product notes shown to consumers',
      },
      roles: {
        label: 'Roles',
        description: 'Blockchain smart contract address where the NFT is minted',
      },
      token: {
        label: 'Token',
        description: 'Unique NFT token identifier on the blockchain',
      },
      typesVersion: {
        label: 'Types Version',
        description: 'Version of the Types protocol used to create this record',
      },
      instance: {
        label: 'Product Instance',
        description: 'Complete supply chain data for this product',
      },
    },
  },
  ProductInstance: {
    name: 'Product Instance',
    header: 'A physical product tracked through its entire supply chain journey',
    fields: {
      type: {
        label: 'Product Type',
        description: 'The name or category of the product displayed in the supply chain tree',
        examples: ['tomato', 'flour', 'pasta', 'chickpea', 'protein powder'],
      },
      ownerId: {
        label: 'Owner',
        description: 'Domain or identifier of the entity that owns/produces this product',
        examples: ['farmname.com', 'producer123', 'manufacturer.org'],
      },
      category: {
        label: 'Category',
        description: 'Main category determining how the product is processed and displayed',
        examples: ['food', 'non-food'],
      },
      expiryDate: {
        label: 'Expiry Date',
        description: 'When the product expires, displayed in local time format',
      },
      bio: {
        label: 'Organic/Bio',
        description: 'Whether the product is certified organic - displayed as YES/NO badge and affects carbon footprint',
      },
      quantity: {
        label: 'Quantity',
        description: 'Weight in grams or volume in milliliters - used for nutrient calculations',
      },
      price: {
        label: 'Price',
        description: 'Pricing information shown in the supply chain details',
      },
      title: {
        label: 'Title',
        description: 'Optional display name for the product (overrides type)',
      },
      notes: {
        label: 'Notes',
        description: 'Detailed product notes shown to consumers',
      },
      pictureURL: {
        label: 'Picture URL',
        description: 'URL to product image displayed in the UI',
      },
      labels: {
        label: 'Labels',
        description: 'Any standard is accepted, related to Health and eco impact.',
        examples: ['Kosher', 'Halal', 'Lactose-free', 'Paleo', 'Keto-friendly', 'organic', 'fair-trade', 'carbon-neutral', 'bpa-free', 'non-gmo', 'recyclable', 'fsc-certified', 'palm-oil-free', 'refined-oil-free', 'BPA-free', 'Lead-free', 'Phthalate-free', 'Pesticide-free', 'Hormone-free'],
      },
    },
  },
  FoodInstance: {
    name: 'Food Instance',
    header: 'A food product with nutritional data, processing history, and environmental impact tracking',
    fields: {
      iDs: {
        label: 'Registry IDs',
        description: 'How this item is idenified in other systems, such as in Food Data Central or retail PLU codes',
        examples: ['FDC: 8901234567890', 'PLU: 4011', 'Organic Cert: US-ORG-123'],
      },
      nutrients: {
        label: 'Nutrients',
        description: 'Nutritional information displayed as bar charts with RDI percentages (proteins, fats, carbs, vitamins, minerals)',
      },
      format: {
        label: 'Format',
        description: 'How the food is prepared or packaged - shown in supply chain tree',
        examples: ['whole', 'sliced', 'diced', 'powder', 'freeze-dried', 'flour'],
      },
      grade: {
        label: 'Grade',
        description: 'Quality classification displayed with grade icon',
        examples: ['A', 'B', 'C', 'premium', 'standard', 'organic'],
      },
      size: {
        label: 'Size',
        description: 'Size classification of individual items (not quantity)',
        examples: ['small', 'medium', 'large', 'XL', 'jumbo'],
      },
      process: {
        label: 'Process',
        description: 'The production/handling process that created this product - displayed as expandable tree node with icon (harvest, milling, freeze-drying, blending, printing, sale)',
      },
      labels: {
        label: 'Labels',
        description: 'Any standard is accepted, related to Health and eco impact.',
        examples: ['low-sugar', 'keto', 'halal', 'kosher', 'lactose-free', 'nut-free', 'organic', 'fair-trade', 'carbon-neutral', 'plastic-free', 'non-gmo', 'pesticide-free', 'hormone-free', 'antibiotic-free', 'cold-pressed'],
      },
    },
  },
  NonFoodInstance: {
    name: 'Non-Food Instance',
    header: 'A non-food product (e.g. cartridge, tool) used in production',
    fields: {
      grade: {
        label: 'Grade',
        description: 'Quality grade of the item',
        examples: ['premium', 'standard', 'industrial'],
      },
      size: {
        label: 'Size',
        description: 'Physical size classification',
        examples: ['small', 'medium', 'large', '100g', '500g'],
      },
      labels: {
        label: 'Labels',
        description: 'Any standard is accepted, related to Health and eco impact.',
        examples: ['food-safe', 'single-use', 'refillable', 'heat-resistant', 'recyclable', 'biodegradable', 'compostable', 'fsc-certified', 'BPA-free', 'lead-free', 'phthalate-free', 'food-contact safe'],
      },
    },
  },
  PackagingInstance: {
    name: 'Packaging Instance',
    header: 'Packaging material used in production or distribution',
    fields: {
      material: {
        label: 'Material',
        description: 'Primary material composition',
        examples: ['cardboard', 'bioplastic', 'glass', 'aluminum'],
      },
      labels: {
        label: 'Labels',
        description: 'Any standard is accepted, related to Health and eco impact.',
        examples: ['reusable', 'single-use', 'recyclable', 'compostable', 'fsc-certified', 'plastic-free', 'food-safe', 'BPA-free'],
      },
    },
  },
  InputInstance: {
    name: 'Input Instance',
    header: 'A product used as an ingredient or material in a production process',
    fields: {
      instance: {
        label: 'Product',
        description: 'Reference to the product being used - can be a token ID or full product data',
      },
      quantity: {
        label: 'Quantity',
        description: 'Amount of this ingredient used in grams or milliliters',
      },
      type: {
        label: 'Input Type',
        description: 'Whether the input comes from the same location (local) or was transported',
        examples: ['local', 'transported'],
      },
      transport: {
        label: 'Shipping',
        description: 'Transportation details showing method, fuel type, duration, and carbon impact',
      },
    },
  },
  LocalInputInstance: {
    name: 'Local Input',
    header: 'An ingredient sourced from the same facility - no transportation required',
    fields: {
      type: {
        label: 'Type',
        description: 'Always "local" - indicates no shipping involved',
      },
    },
  },
  TransportedInputInstance: {
    name: 'Transported Input',
    header: 'An ingredient that was shipped to the production facility',
    fields: {
      type: {
        label: 'Type',
        description: 'Always "transported" - triggers display of shipping details',
      },
      transport: {
        label: 'Transport',
        description: 'Shipping information displayed in tree with vehicle icon',
      },
    },
  },
  Transport: {
    name: 'Transport',
    header: 'Shipping details for moving products between facilities - impacts carbon footprint',
    fields: {
      method: {
        label: 'Shipping Method',
        description: 'Mode of transportation - displayed with corresponding icon (plane/truck/boat)',
        examples: ['air', 'sea', 'land'],
      },
      fuelType: {
        label: 'Fuel Type',
        description: 'Energy source used - affects environmental impact calculation',
        examples: ['hydrogen', 'electric', 'diesel', 'petrol', 'kerosene'],
      },
      weight: {
        label: 'Share',
        description: 'Percentage (0-1) of vehicle capacity used by this product - shown as "Share: X%"',
        examples: ['0.25 (25%)', '0.5 (50%)', '1.0 (100%)'],
      },
      deparetureTime: {
        label: 'Departure Time',
        description: 'When the shipment left - displayed with clock icon in local datetime format',
      },
      duration: {
        label: 'Duration',
        description: 'How long the transport took in seconds - shown in human-readable format (e.g., "2 hours 30 minutes")',
      },
    },
  },
  Process: {
    name: 'Process',
    header: 'A production or handling step in the supply chain - displayed as expandable tree nodes with specific icons',
    fields: {
      type: {
        label: 'Process Type',
        description: 'The kind of processing applied',
        examples: ['printing', 'milling', 'freezedrying', 'blending', 'sale', 'harvest', 'cooking'],
      },
      timestamp: {
        label: 'Time',
        description: 'When the process occurred - displayed with clock icon in local datetime format',
      },
      duration: {
        label: 'Duration',
        description: 'How long the process took in seconds - shown as human-readable (e.g., "45 minutes")',
      },
      facility: {
        label: 'Facility',
        description: 'The location where processing occurred - shown with factory icon and GPS coordinates on map',
      },
      site: {
        label: 'Site',
        description: 'Legacy field name for facility',
      },
      temperatureRange: {
        label: 'Temperature Range',
        description: 'Min and max temperature during processing in Celsius - displayed with thermostat icon',
      },
      inputInstances: {
        label: 'Inputs',
        description: 'Ingredients or materials used - each shown as tree branch with transport info if shipped',
      },
      impacts: {
        label: 'Environmental Impacts',
        description: 'Carbon and water footprint - summed across supply chain and shown in impact badges',
      },
      price: {
        label: 'Price',
        description: 'Cost of this processing step or sale price to customer',
      },
      machineInstance: {
        label: 'Machine',
        description: 'Equipment used for processing - can be full data or token ID reference',
      },
      knowHow: {
        label: 'Know-How',
        description: 'Recipe or process instructions - can be full data or token ID reference',
      },
      shape: {
        label: 'Shape',
        description: '3D model URL for printing processes - shown with interests icon',
      },
    },
  },
  PrintingProcess: {
    name: '3D Printing',
    header: 'Additive manufacturing process creating food from cartridges',
    fields: {
      machineInstance: {
        label: 'Printer',
        description: '3D food printer used (object or token ID)',
      },
      knowHow: {
        label: 'Recipe',
        description: 'Printing instructions and parameters (object or token ID)',
      },
      shape: {
        label: 'Shape URL',
        description: 'Link to 3D model file used for printing',
      },
    },
  },
  MillingProcess: {
    name: 'Milling',
    header: 'Grinding or crushing process (e.g., wheat to flour)',
    fields: {
      machineInstance: {
        label: 'Mill',
        description: 'Milling equipment used (object or token ID)',
      },
      knowHow: {
        label: 'Process Recipe',
        description: 'Milling parameters and instructions (object or token ID)',
      },
    },
  },
  FreezeDryingProcess: {
    name: 'Freeze-Drying',
    header: 'Lyophilization process removing moisture while preserving nutrients',
    fields: {
      machineInstance: {
        label: 'Freeze Dryer',
        description: 'Lyophilization equipment used (object or token ID)',
      },
      knowHow: {
        label: 'Process Recipe',
        description: 'Temperature curve and timing (object or token ID)',
      },
    },
  },
  BlendingProcess: {
    name: 'Blending',
    header: 'Mixing multiple ingredients together',
    fields: {
      machineInstance: {
        label: 'Blender',
        description: 'Blending equipment used (object or token ID)',
      },
      knowHow: {
        label: 'Recipe',
        description: 'Blending time, speed, and sequence (object or token ID)',
      },
    },
  },
  SaleProcess: {
    name: 'Sale',
    header: 'Final sale to consumer - displayed with "Sold to you" label',
    fields: {
      price: {
        label: 'Sale Price',
        description: 'Price paid by the consumer',
      },
    },
  },
  HarvestProcess: {
    name: 'Harvesting',
    header: 'Initial collection of raw agricultural products',
    fields: {
      facility: {
        label: 'Farm',
        description: 'Where the crop was harvested',
      },
    },
  },
  CookingProcess: {
    name: 'Cooking',
    header: 'Thermal processing of food',
    fields: {
      method: {
        label: 'Method',
        description: 'Cooking technique applied',
        examples: ['baking', 'boiling', 'frying'],
      },
      machineInstance: {
        label: 'Appliance',
        description: 'Oven, stove, or thermal equipment',
      },
      knowHow: {
        label: 'Recipe',
        description: 'Cooking instructions',
      },
    },
  },
  Facility: {
    name: 'Facility',
    header: 'A physical location where processing occurs - shown on interactive map',
    fields: {
      label: {
        label: 'Name',
        description: 'Human-readable facility name (defaults to "Unnamed Facility" if omitted)',
        examples: ['Green Valley Farm', 'Mill #3', 'Distribution Center'],
      },
      location: {
        label: 'GPS Location',
        description: 'Geographic coordinates displayed as marker on satellite map and in tree as [longitude, latitude]',
      },
    },
  },
  Site: {
    name: 'Site',
    header: 'Legacy name for Facility',
    fields: {
      label: {
        label: 'Name',
        description: 'Facility name',
      },
      location: {
        label: 'Location',
        description: 'GPS coordinates',
      },
    },
  },
  Price: {
    name: 'Price',
    header: 'Financial information displayed with currency symbol in tree',
    fields: {
      amount: {
        label: 'Amount',
        description: 'Numerical price value',
        examples: ['19.99', '5.50', '125.00'],
      },
      currency: {
        label: 'Currency',
        description: 'Currency code following ISO 4217 standard',
        examples: ['USD', 'EUR', 'GBP', 'CHF', 'JPY'],
      },
      type: {
        label: 'Price Type',
        description: 'Payment structure or timing - affects how price is displayed and calculated',
        examples: ['is', 'budget', '%', 'payin30days', 'payin60days'],
      },
    },
  },
  TemperatureRange: {
    name: 'Temperature Range',
    header: 'Temperature bounds during processing - displayed with thermostat icon',
    fields: {
      min: {
        label: 'Minimum',
        description: 'Lowest temperature in Celsius during the process',
        examples: ['-40', '0', '20', '100'],
      },
      max: {
        label: 'Maximum',
        description: 'Highest temperature in Celsius during the process',
        examples: ['25', '80', '150', '200'],
      },
    },
  },
  MachineInstance: {
    name: 'Machine',
    header: 'Equipment used in production processes - displayed with settings icon',
    fields: {
      category: {
        label: 'Machine Type',
        description: 'Type of equipment',
        examples: ['3D Printer', 'Mill', 'Blender', 'Freeze Dryer', 'Oven'],
      },
      ownerId: {
        label: 'Owner',
        description: 'Who owns the equipment - shown with copyright icon',
      },
      quantity: {
        label: 'Quantity',
        description: 'Number of machines used or production capacity',
      },
      size: {
        label: 'Size',
        description: 'Physical size or capacity classification',
        examples: ['small', 'medium', 'large', 'industrial'],
      },
      ratedPowerKW: {
        label: 'Rated Power (kW)',
        description: 'Power consumption rating in kilowatts',
        examples: ['0.5', '1.2', '5.0'],
      },
      hr: {
        label: 'Tasks',
        description: 'Human resources - who operated the machine',
      },
      providerSDomain: {
        label: 'Provider',
        description: 'Equipment manufacturer or supplier domain',
      },
    },
  },
  Hr: {
    name: 'Human Resources',
    header: 'Personnel assignment for equipment operation',
    fields: {
      tasks: {
        label: 'Tasks',
        description: 'Description of work performed by the operator',
        examples: ['machine operation', 'quality control', 'supervision'],
      },
      assignee: {
        label: 'Assignee',
        description: 'Name or ID of person assigned - shown with person icon',
      },
    },
  },
  KnowHow: {
    name: 'Know-How',
    header: 'Recipe or process instructions - displayed with numbered list icon',
    fields: {
      owner: {
        label: 'Owner',
        description: 'Who owns the intellectual property - shown with copyright icon',
      },
      hash: {
        label: 'Hash',
        description: 'Cryptographic hash of the recipe for verification and IP protection',
      },
      inputs: {
        label: 'Inputs',
        description: 'Description of required input materials',
      },
      outputs: {
        label: 'Outputs',
        description: 'Description of what the process produces',
      },
      licenseFee: {
        label: 'License Fee',
        description: 'Cost to use this recipe/process',
      },
      note: {
        label: 'Note',
        description: 'Additional instructions or comments',
      },
      logoURL: {
        label: 'Logo URL',
        description: 'Link to brand or recipe logo image',
      },
    },
  },
  Impact: {
    name: 'Environmental Impact',
    header: 'Ecological footprint metrics - summed across supply chain and shown in badges',
    fields: {
      category: {
        label: 'Impact Category',
        description: 'Type of environmental impact',
        examples: ['carbon', 'water'],
      },
      ownerId: {
        label: 'Owner',
        description: 'Entity responsible for this impact',
      },
      format: {
        label: 'Format',
        description: 'How the impact is measured or categorized',
      },
      quantity: {
        label: 'Quantity',
        description: 'Amount of impact: kg for carbon (CO2e), liters for water',
      },
    },
  },
  CarbonImpact: {
    name: 'Carbon Footprint',
    header: 'CO2 equivalent emissions - displayed as "X kg CO2e CARBON FOOTPRINT"',
    fields: {
      quantity: {
        label: 'CO2e Amount',
        description: 'Kilograms of carbon dioxide equivalent',
      },
    },
  },
  WaterImpact: {
    name: 'Water Footprint',
    header: 'Water usage - displayed as "X l WATER FOOTPRINT"',
    fields: {
      quantity: {
        label: 'Water Volume',
        description: 'Liters of water consumed in production',
      },
    },
  },
  ID: {
    name: 'Registry ID',
    header: 'Regulatory or certification identifiers - shown with fingerprint icon',
    fields: {
      registry: {
        label: 'Registry Name',
        description: 'The system or authority issuing the ID',
        examples: ['EAN', 'PLU', 'Organic Certification', 'FDA', 'USDA'],
      },
      id: {
        label: 'ID Value',
        description: 'The actual identifier string',
        examples: ['8901234567890', '4011', 'US-ORG-123'],
      },
    },
  },
  FallbackFoodNutrient: {
    name: 'Nutrient Value',
    header: 'Nutritional content per 100g - displayed as bar charts with RDI percentages',
    fields: {
      amount: {
        label: 'Amount',
        description: 'Quantity of nutrient per 100g of product',
      },
      iD: {
        label: 'Nutrient ID',
        description: 'Reference to USDA FoodData Central nutrient definition',
      },
    },
  },
  Location: {
    name: 'Location',
    header: 'GeoJSON Point with GPS coordinates - displayed on interactive satellite map',
    fields: {
      type: {
        label: 'Type',
        description: 'Always "Point" for GeoJSON format',
      },
      coordinates: {
        label: 'Coordinates',
        description: 'Array of [longitude, latitude] in decimal degrees',
        examples: ['[7.5885, 47.5595]', '[-122.3321, 47.6062]'],
      },
    },
  },
};

/**
 * Get description for a type and field
 * @param typeName - Name of the type (e.g., 'ProductInstance')
 * @param fieldName - Name of the field
 * @returns FieldDescription or undefined if not found
 */
export function getFieldDescription(
  typeName: string,
  fieldName: string
): FieldDescription | undefined {
  return typeDescriptions[typeName]?.fields[fieldName];
}

/**
 * Get type description
 * @param typeName - Name of the type
 * @returns TypeDescription or undefined if not found
 */
export function getTypeDescription(typeName: string): TypeDescription | undefined {
  return typeDescriptions[typeName];
}

/**
 * Get all available type names
 * @returns Array of type names that have descriptions
 */
export function getAllTypeNames(): string[] {
  return Object.keys(typeDescriptions);
}

/**
 * Get icon name for a process type (for Quasar icons)
 * @param processType - The process type
 * @returns Icon name string
 */
export function getProcessIcon(processType: string): string {
  const icons: Record<string, string> = {
    sale: 'sell',
    printing: 'print',
    blending: 'blender',
    milling: 'deblur',
    freezedrying: 'ac_unit',
    harvest: 'agriculture',
  };
  return icons[processType] || 'question_mark';
}

/**
 * Get human-readable label for a process type
 * @param processType - The process type
 * @returns Display label
 */
export function getProcessLabel(processType: string): string {
  const labels: Record<string, string> = {
    sale: 'Sold to you',
    printing: '3D Printing',
    blending: 'Blending',
    milling: 'Milling',
    freezedrying: 'Freeze-drying',
    harvest: 'Harvesting',
  };
  return labels[processType] || 'Unknown process';
}

/**
 * Check if a type has descriptions available
 * @param typeName - Name of the type to check
 * @returns true if descriptions exist
 */
export function hasTypeDescription(typeName: string): boolean {
  return typeName in typeDescriptions;
}
