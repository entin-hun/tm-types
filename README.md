# @trace.market/types

TypeScript type definitions for the Trace Market food supply chain traceability platform.

## Overview

This package provides comprehensive TypeScript types for food traceability data, including:
- **Product instances**: Food items, cartridges, and other products
- **Process tracking**: Milling, printing, freeze-drying, blending, sales, and harvests
- **Supply chain data**: Transport, facilities, locations, and impacts
- **Blockchain integration**: NFT metadata and token references

## Installation

```bash
npm install @trace.market/types
```

## Usage

```typescript
import {
  FoodInstance,
  ProductInstance,
  Pokedex,
  SaleProcess,
  Impact
} from '@trace.market/types';

const product: FoodInstance = {
  category: 'food',
  type: 'coconut-drink',
  bio: true,
  quantity: 1000,
  ownerId: 'plantsoul',
  process: {
    type: 'blending',
    timestamp: Date.now(),
    facility: {
      label: 'PlantSoul Factory',
      location: {
        type: 'Point',
        coordinates: [19.0402, 47.4979]
      }
    },
    temperatureRange: { min: 4, max: 8 },
    inputInstances: [],
    impacts: [
      {
        category: 'carbon',
        ownerId: 'plantsoul',
        format: 'CO2e',
        quantity: 0.5
      }
    ]
  }
};
```

## Available Types

### Core Types
- `Pokedex`: Main container for NFT metadata and product instances
- `ProductInstance`: Union type for all product categories
- `FoodInstance`: Food products with nutrition and process data
- `CartridgeInstance`: Printer cartridge tracking

### Process Types
- `Process`: Union of all process types
- `GenericProcess`: Base process interface
- `MillingProcess`: Grain/seed processing
- `PrintingProcess`: 3D printing operations
- `FreezeDryingProcess`: Freeze-drying operations
- `BlendingProcess`: Mixing ingredients
- `SaleProcess`: Sales transactions
- `HarvestProcess`: Agricultural harvesting

### Supply Chain
- `InputInstance`: Local or transported inputs
- `Transport`: Transportation tracking
- `Facility`: Processing facilities and locations
- `Location`: GeoJSON point coordinates

### Environmental Impact
- `Impact`: Union of impact types
- `CarbonImpact`: CO2 emissions
- `WaterImpact`: Water usage

### Supporting Types
- `Price`: Pricing information
- `KnowHow`: Proprietary process knowledge
- `MachineInstance`: Equipment tracking
- `TemperatureRange`: Storage/process temperatures
- `FallbackFoodNutrient`: Nutrition data
- `ID`: Registry identifiers

## MCP Server

This package includes an MCP (Model Context Protocol) server for intelligent type management. See [mcp-server/README.md](./mcp-server/README.md) for details.

### Key Features
- **Natural language type creation**: Describe types in plain English
- **Automatic validation**: Check data against type definitions
- **Custom reports**: Generate formatted reports from your data
- **Authentication support**: Secure type management for authorized users
- **Public API**: Anonymous access for queries and reports

## Contributing

This is a self-managed repository for the Trace Market team. To add or modify types:

1. **For authenticated users**: Use the MCP server's `create_type_from_description` tool
2. **Manual method**: Edit `src/index.d.ts` and submit a pull request
3. **Automated**: CI/CD will validate and publish on merge to main

### Versioning

We use semantic versioning:
- **Patch** (0.0.x): Documentation, comments, minor fixes
- **Minor** (0.x.0): New types, backward-compatible changes
- **Major** (x.0.0): Breaking changes to existing types

Update the version in `package.json` before committing changes that should trigger a new npm release.

## CI/CD

- **Automatic publishing**: Pushes to main trigger npm publish if version changed
- **Validation**: TypeScript compilation runs on all commits
- **MCP server builds**: Automatic builds on changes to mcp-server/

## Repository

- **GitHub**: https://github.com/entin-hun/tm-types
- **npm**: https://www.npmjs.com/package/@trace.market/types (coming soon)

## License

MIT

## Related Projects

- [tm-editor](../tm-editor): Visual editor for creating product instances
- [tm-marketplace](../tm-marketplace): NFT marketplace for traced products
- [tm-package-page](../tm-package-page%20buy): Consumer-facing product pages
