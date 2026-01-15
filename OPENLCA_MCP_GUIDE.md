# OpenLCA Integration - Type Descriptions

## Overview

The openLCA integration transforms Trace Market supply chain data into the openLCA schema format for Life Cycle Assessment (LCA) calculations.

## Key Concepts for MCP

When assisting with openLCA integration, keep these mappings in mind:

### Data Flow
```
Trace Market → OpenLCA Transformer → OpenLCA API → LCA Results
```

### Core Mappings

| Trace Market Type | OpenLCA Type | Purpose |
|------------------|--------------|---------|
| ProductInstance | Flow | Materials/products flowing through supply chain |
| Process (printing, milling, etc.) | Process | Unit processes with inputs/outputs |
| InputInstance | Exchange (input=true) | Materials consumed by process |
| Product output | Exchange (output, quantRef=true) | What the process produces |
| Impact (carbon/water) | Exchange (emission) | Environmental outputs |
| Site/Facility | Location | Geographic reference |

### Important Conversions

1. **Units**: Grams → Kilograms (divide by 1000)
2. **Timestamps**: Unix seconds → ISO 8601 datetime string
3. **Coordinates**: `[longitude, latitude]` → Location reference
4. **Process Types**: Trace Market process.type → openLCA Process name

### OpenLCA Schema Requirements

Every Process must have:
- `@type: "Process"`
- `@id`: UUID v4
- `name`: Human-readable
- `exchanges`: Array with at least one quantitative reference
- `lastInternalId`: Highest exchange internal ID

Every Exchange must have:
- `internalId`: Unique within process (1, 2, 3...)
- `amount`: Numerical value
- `isInput`: true for inputs, false for outputs
- `isQuantitativeReference`: true for exactly one exchange per process
- `flow`, `unit`, `flowProperty`: References to openLCA entities

### Standard References

Use these standard IDs for compatibility:
- Mass Flow Property: `93a60a56-a3c8-11da-a746-0800200b9a66`
- Kilogram Unit: `20aadc24-a391-41cf-b340-3e4529f44bde`

## For Type Description Generation

When generating descriptions for openLCA-related fields:

1. **Mention transformation**: "Converted to X in openLCA format"
2. **Note unit changes**: "Converted from grams to kilograms"
3. **Explain mapping**: "Becomes an Exchange in openLCA Process"
4. **Reference standards**: "Uses standard Mass flow property ID"

### Example Field Descriptions

```typescript
quantity: {
  label: 'Quantity',
  description: 'Amount in grams - converted to kg for openLCA LCA calculations',
  examples: ['1000 (1 kg)', '250 (0.25 kg)'],
}

impacts: {
  label: 'Environmental Impacts',
  description: 'Carbon and water footprint - converted to emission Exchanges in openLCA',
  examples: ['[{category: "carbon", quantity: 2.5}]'],
}
```

## Common Patterns

### Process Traversal
```typescript
// Recursively walk supply chain
function traverse(instance: ProductInstance) {
  if (instance.category === 'food' && instance.process) {
    // Convert this process
    const process = convertProcess(instance.process);
    
    // Traverse inputs
    instance.process.inputInstances.forEach(input => {
      if (typeof input.instance === 'object') {
        traverse(input.instance);
      }
    });
  }
}
```

### Exchange Creation
```typescript
const exchange: OpenLCAExchange = {
  '@type': 'Exchange',
  internalId: ++idCounter,
  amount: quantity / 1000, // g → kg
  isInput: true,
  isQuantitativeReference: false,
  flow: { '@type': 'Flow', '@id': flowId, name: flowName },
  unit: KG_UNIT,
  flowProperty: MASS_FLOW_PROPERTY,
};
```

## Files Created

1. **openLCATransformer.ts**: Core transformation logic
2. **openLCAClient.ts**: API communication and utilities
3. **OPENLCA_INTEGRATION.md**: Comprehensive documentation

## MCP Assistance Tips

When asked to:

- **"Add impact calculation"** → Use `estimateImpacts()` from openLCAClient
- **"Export to openLCA"** → Use `downloadOpenLCAExport()`
- **"Convert process"** → Reference `convertProcess()` in transformer
- **"Fix schema"** → Check against http://greendelta.github.io/olca-schema/
- **"Add transport"** → Convert Transport to Process with fuel as input

## Validation

Valid openLCA JSON must:
1. Have `@type` on every entity
2. Use valid UUIDs for `@id`
3. Have at least one quantitative reference per Process
4. Link Exchanges to valid Flows
5. Reference standard Units and FlowProperties

## Testing

Test conversion with:
```typescript
import { convertToOpenLCA } from './openLCATransformer';

const productSystem = convertToOpenLCA(pokedex);
console.log(JSON.stringify(productSystem, null, 2));
```

Expected output structure:
```json
{
  "@type": "ProductSystem",
  "name": "...",
  "processes": [...],
  "processLinks": [...]
}
```
