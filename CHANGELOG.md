# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2026-01-19

### ⚠ BREAKING CHANGES
- **Transport**: `weight` definition changed from "share (0-1)" to "Total vehicle payload in tonnes". This requires data migration for existing records.

### Features
- **Process Types**: Added `PyrolysisProcess` and `DistillationProcess`.
- **Process**: Added `notes` to `GenericProcess` for capturing real-time or run-specific data (pressure, speed, etc.).
- **Icons**: Added icons for new processes (`local_fire_department` for Pyrolysis, `science` for Distillation).

## [0.3.0] - 2026-01-19

### ⚠ BREAKING CHANGES
- **Renaming**: `MachineInstance` is renamed to `ToolInstance`. All references to `machineInstance` in processes are renamed to `toolInstance`.
- **Structure**: `hr` (Human Resources) field moved from `ToolInstance` to `Process` interface. It is now a sibling of `toolInstance`.
- **Typing**: `Hr.tasks` is now `string[]` (array of strings) instead of `string`.
- **Typing**: `KnowHow.inputs` is explicitly defined as a JSONata expression string.
- **Data Model**: Renamed `CartridgeInstance` to `NonFoodInstance` with category `non-food`.
- **Data Model**: Removed `PackagingProcess` and `StorageProcess`.
- **Data Model**: Consolidated `ecoLabels` and `qualityAttributes` into a single `labels` array.

### Features
- Added `hash` field to `ToolInstance`.
- Added support for ordered steps in `Hr.tasks`.
- Validation rules in `KnowHow` are now standardized as JSONata.

### Documentation (descriptions.json)
- Renamed root field `description` to `header`.
- Updated all labels and examples to reflect the new "Tool" terminology and "JSONata" rules.
