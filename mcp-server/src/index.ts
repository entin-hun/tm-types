#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { runExtraction } from "./ai-service.js";
import { suggestFood } from "./food-service.js";
import { suggestNonFood, decomposeNonFood } from "./non-food-service.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to types definition file
// From mcp-server/dist/index.js, go up to mcp-server, then up to tm-types, then into src
const TYPES_PATH = join(__dirname, "../../src/index.d.ts");
const EDITORS_PATH = join(__dirname, "../../tm-editor/src/components/editors");
const TREE_VIEW_PATH = join(__dirname, "../../tm-package-page/src/components/FoodChainTree.vue");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const DEFAULT_AUTH_TOKEN = process.env.DEFAULT_AUTH_TOKEN;

interface AuthContext {
  userId?: string;
  role?: "admin" | "user" | "anonymous";
}

// Authentication helper
function verifyAuth(token?: string): AuthContext {
  const candidate = token || DEFAULT_AUTH_TOKEN;
  if (!candidate) {
    return { role: "anonymous" };
  }
  
  try {
    const decoded = jwt.verify(candidate, JWT_SECRET) as any;
    return {
      userId: decoded.userId,
      role: decoded.role || "user",
    };
  } catch (error) {
    return { role: "anonymous" };
  }
}

// Read current types
function readTypes(): string {
  if (!existsSync(TYPES_PATH)) {
    throw new Error(`Types file not found at ${TYPES_PATH}`);
  }
  return readFileSync(TYPES_PATH, "utf-8");
}

// Write types (only for authenticated users)
function writeTypes(content: string, auth: AuthContext): void {
  if (auth.role === "anonymous") {
    throw new Error("Authentication required to modify types");
  }
  writeFileSync(TYPES_PATH, content, "utf-8");
}

// Parse type definition to extract metadata
function parseTypeDefinitions(content: string) {
  const interfacePattern = /export\s+interface\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{([^}]+)\}/g;
  const typePattern = /export\s+type\s+(\w+)\s*=\s*([^;]+);/g;
  
  const interfaces: any[] = [];
  const types: any[] = [];
  
  let match;
  while ((match = interfacePattern.exec(content)) !== null) {
    const [, name, extendsFrom, body] = match;
    const fields = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//") && !line.startsWith("/*"))
      .map((line) => {
        const fieldMatch = line.match(/(\w+)(\?)?:\s*([^;]+);?/);
        if (fieldMatch) {
          const [, fieldName, optional, fieldType] = fieldMatch;
          return {
            name: fieldName,
            type: fieldType.trim(),
            optional: !!optional,
          };
        }
        return null;
      })
      .filter(Boolean);
    
    interfaces.push({
      kind: "interface",
      name,
      extends: extendsFrom || null,
      fields,
    });
  }
  
  while ((match = typePattern.exec(content)) !== null) {
    const [, name, definition] = match;
    types.push({
      kind: "type",
      name,
      definition: definition.trim(),
    });
  }
  
  return { interfaces, types };
}

// Generate TypeScript type from natural language
async function generateTypeFromNL(description: string, existingTypes: string): Promise<string> {
  // This is a simplified version - in production, you'd use an LLM API
  // For now, we'll return a template that needs to be filled
  const typeName = description
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("")
    .replace(/[^a-zA-Z0-9]/g, "");
  
  return `
// Generated from: ${description}
export interface ${typeName} {
  // TODO: Fill in fields based on description
  id: string;
  createdAt: number;
}
`.trim();
}

// Extract interface fields from TypeScript definition
function extractInterfaceFields(interfaceCode: string): { name: string; type: string; optional: boolean }[] {
  const fields: { name: string; type: string; optional: boolean }[] = [];
  const lines = interfaceCode.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('export') || trimmed.startsWith('{') || trimmed.startsWith('}')) {
      continue;
    }
    
    const fieldMatch = trimmed.match(/(\w+)(\?)?:\s*([^;]+);?/);
    if (fieldMatch) {
      const [, fieldName, optional, fieldType] = fieldMatch;
      fields.push({
        name: fieldName,
        type: fieldType.trim(),
        optional: !!optional
      });
    }
  }
  
  return fields;
}

// Detect which interfaces changed
function detectChangedInterfaces(oldContent: string, newContent: string): { interfaceName: string; newFields: { name: string; type: string; optional: boolean }[] }[] {
  const oldInterfaces = parseTypeDefinitions(oldContent).interfaces;
  const newInterfaces = parseTypeDefinitions(newContent).interfaces;
  
  const changes: { interfaceName: string; newFields: { name: string; type: string; optional: boolean }[] }[] = [];
  
  for (const newInterface of newInterfaces) {
    const oldInterface = oldInterfaces.find(i => i.name === newInterface.name);
    
    if (oldInterface) {
      const oldFieldNames = oldInterface.fields.map((f: any) => f.name);
      const newFields = newInterface.fields.filter((f: any) => !oldFieldNames.includes(f.name));
      
      if (newFields.length > 0) {
        changes.push({
          interfaceName: newInterface.name,
          newFields
        });
      }
    }
  }
  
  return changes;
}

// Update Vue editor files
function updateVueEditors(changes: { interfaceName: string; newFields: { name: string; type: string; optional: boolean }[] }[]): void {
  if (!existsSync(EDITORS_PATH)) {
    console.error(`Editors path not found: ${EDITORS_PATH}`);
    return;
  }
  
  const editorMap: { [key: string]: string } = {
    'ProductInstanceBase': 'FoodInstanceEditor.vue', // Also affects CartridgeInstance
    'FoodInstance': 'FoodInstanceEditor.vue',
    'CartridgeInstance': 'CartridgeInstanceEditor.vue',
    'KnowHow': 'KnowHowEditor.vue',
    'MachineInstance': 'MachineInstanceEditor.vue',
    'Price': 'PriceEditor.vue',
    'Transport': 'TransportEditor.vue',
    'GenericProcess': 'processes/GenericProcessEditor.vue',
  };
  
  for (const change of changes) {
    const editorFile = editorMap[change.interfaceName];
    if (!editorFile) continue;
    
    const editorPath = join(EDITORS_PATH, editorFile);
    if (!existsSync(editorPath)) continue;
    
    try {
      let content = readFileSync(editorPath, 'utf-8');
      
      // Find the template section
      const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
      if (!templateMatch) continue;
      
      let template = templateMatch[1];
      
      // Find where to insert new fields (after type field or at start)
      const insertPatterns = [
        /<BasicInput v-model="value\.type" label="type" \/>/,
        /<BasicInput v-model="value\.owner" label="owner"/,
        /<q-checkbox/
      ];
      
      let insertIndex = -1;
      let insertAfter = '';
      
      for (const pattern of insertPatterns) {
        const match = template.match(pattern);
        if (match) {
          insertIndex = template.indexOf(match[0]) + match[0].length;
          insertAfter = match[0];
          break;
        }
      }
      
      if (insertIndex === -1) continue;
      
      // Generate new BasicInput fields
      const newFields = change.newFields
        .map(field => `\n    <BasicInput v-model="value.${field.name}" label="${field.name}" />`)
        .join('');
      
      // Insert new fields
      template = template.slice(0, insertIndex) + newFields + template.slice(insertIndex);
      
      // Replace template in content
      content = content.replace(/<template>[\s\S]*?<\/template>/, `<template>${template}</template>`);
      
      writeFileSync(editorPath, content, 'utf-8');
      console.error(`Updated editor: ${editorFile}`);
      
      // If ProductInstanceBase changed, also update CartridgeInstanceEditor
      if (change.interfaceName === 'ProductInstanceBase' && editorFile.includes('Food')) {
        const cartridgePath = join(EDITORS_PATH, 'CartridgeInstanceEditor.vue');
        if (existsSync(cartridgePath)) {
          let cartridgeContent = readFileSync(cartridgePath, 'utf-8');
          const cartridgeTemplateMatch = cartridgeContent.match(/<template>([\s\S]*?)<\/template>/);
          if (cartridgeTemplateMatch) {
            let cartridgeTemplate = cartridgeTemplateMatch[1];
            const cartridgeMatch = cartridgeTemplate.match(/<BasicInput v-model="value\.type" label="type" \/>/);
            if (cartridgeMatch) {
              const cartridgeIndex = cartridgeTemplate.indexOf(cartridgeMatch[0]) + cartridgeMatch[0].length;
              cartridgeTemplate = cartridgeTemplate.slice(0, cartridgeIndex) + newFields + cartridgeTemplate.slice(cartridgeIndex);
              cartridgeContent = cartridgeContent.replace(/<template>[\s\S]*?<\/template>/, `<template>${cartridgeTemplate}</template>`);
              writeFileSync(cartridgePath, cartridgeContent, 'utf-8');
              console.error(`Updated editor: CartridgeInstanceEditor.vue`);
            }
          }
        }
      }
    } catch (error: any) {
      console.error(`Error updating ${editorFile}: ${error.message}`);
    }
  }
}

// Generate tree node helper function for a field
function generateTreeNodeHelper(fieldName: string, fieldType: string, optional: boolean): string {
  const capitalizedName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  const iconMap: { [key: string]: string } = {
    title: 'title',
    description: 'description',
    pictureURL: 'image',
    logoURL: 'image',
    url: 'link',
    email: 'email',
    phone: 'phone',
    address: 'location_on',
    name: 'badge',
  };
  
  const icon = iconMap[fieldName] || 'info';
  
  return `
function ${fieldName}ToNodes(${fieldName}?: ${fieldType}): QTreeNode[] {
  return ${fieldName} !== undefined
    ? [
        {
          label: \`${capitalizedName}: \${${fieldName}}\`,
          icon: '${icon}',
        },
      ]
    : [];
}`;
}

// Update tree view component
function updateTreeView(changes: { interfaceName: string; newFields: { name: string; type: string; optional: boolean }[] }[]): void {
  if (!existsSync(TREE_VIEW_PATH)) {
    console.error(`Tree view not found: ${TREE_VIEW_PATH}`);
    return;
  }
  
  const treeViewInterfaceMap: { [key: string]: { functionName: string; insertPattern: RegExp } } = {
    'ProductInstanceBase': {
      functionName: 'foodInstanceToNode',
      insertPattern: /\.\.\.(ownerIdToNodes|quantityToNodes|bioToNodes)\(food\.\w+\)/
    },
    'FoodInstance': {
      functionName: 'foodInstanceToNode',
      insertPattern: /\.\.\.(ownerIdToNodes|quantityToNodes|bioToNodes)\(food\.\w+\)/
    },
    'CartridgeInstance': {
      functionName: 'cartridgeInstanceToNode',
      insertPattern: /\.\.\.(ownerIdToNodes|quantityToNodes|bioToNodes)\(cartridge\.\w+\)/
    },
    'KnowHow': {
      functionName: 'knowHowToNode',
      insertPattern: /label: `Owner: \${recipe\.owner}`/
    },
    'MachineInstance': {
      functionName: 'machineInstanceToNode',
      insertPattern: /\.\.\.(ownerIdToNodes|quantityToNodes|sizeToNodes)\(machine\.\w+\)/
    },
  };
  
  const relevantChanges = changes.filter(c => treeViewInterfaceMap[c.interfaceName]);
  if (relevantChanges.length === 0) return;
  
  try {
    let content = readFileSync(TREE_VIEW_PATH, 'utf-8');
    
    // Find the end of the script (before </script>)
    const scriptEndMatch = content.match(/<\/script>/);
    if (!scriptEndMatch) return;
    
    const helperFunctionsToAdd: string[] = [];
    
    for (const change of relevantChanges) {
      const mapping = treeViewInterfaceMap[change.interfaceName];
      const varName = change.interfaceName === 'KnowHow' ? 'recipe' : 
                      change.interfaceName === 'MachineInstance' ? 'machine' :
                      change.interfaceName === 'CartridgeInstance' ? 'cartridge' : 'food';
      
      // Generate helper functions
      for (const field of change.newFields) {
        const helperFunction = generateTreeNodeHelper(field.name, field.type, field.optional);
        if (!content.includes(`function ${field.name}ToNodes(`)) {
          helperFunctionsToAdd.push(helperFunction);
        }
      }
      
      // Find the function and add the new field references
      const functionPattern = new RegExp(
        `function ${mapping.functionName}[^{]+{[\\s\\S]*?children: \\[[\\s\\S]*?\\]`,
        'g'
      );
      
      const functionMatch = content.match(functionPattern);
      if (functionMatch) {
        const originalFunction = functionMatch[0];
        let updatedFunction = originalFunction;
        
        // Find where to insert (after the first optional field usage)
        const insertMatch = updatedFunction.match(mapping.insertPattern);
        if (insertMatch) {
          const insertIndex = updatedFunction.indexOf(insertMatch[0]) + insertMatch[0].length;
          
          // Add new field references
          const newFieldRefs = change.newFields
            .map(field => `\n      ...${field.name}ToNodes(${varName}.${field.name}),`)
            .join('');
          
          updatedFunction = updatedFunction.slice(0, insertIndex) + newFieldRefs + updatedFunction.slice(insertIndex);
          content = content.replace(originalFunction, updatedFunction);
        }
      }
    }
    
    // Add helper functions before </script>
    if (helperFunctionsToAdd.length > 0) {
      const insertIndex = content.indexOf('</script>');
      content = content.slice(0, insertIndex) + '\n' + helperFunctionsToAdd.join('\n') + '\n' + content.slice(insertIndex);
    }
    
    writeFileSync(TREE_VIEW_PATH, content, 'utf-8');
    console.error('Updated tree view component');
  } catch (error: any) {
    console.error(`Error updating tree view: ${error.message}`);
  }
}

// Express Server Setup
const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 3456; 

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-ai-provider']
}));
app.use(express.json({ limit: '10mb' }));

app.post('/extract', async (req, res) => {
  try {
      const { text, attachments } = req.body;
      if (!text && (!attachments || attachments.length === 0)) {
          return res.status(400).json({ error: "Text or attachments required" });
      }
      
      console.error(`[HTTP] Extraction requested for ${text?.slice(0, 50)}...`);
      const result = await runExtraction({ text, attachments });
      res.json(result);
  } catch (error: any) {
      console.error('[HTTP] Extraction error:', error);
      res.status(500).json({ error: error.message });
  }
});

app.post('/suggest/food', async (req, res) => {
  try {
      console.error(`[HTTP] Food suggestion requested`);
      const authHeader = req.headers.authorization;
      const providerHeader = req.headers['x-ai-provider'];
      
      let apiKeys: any = {};
      if (authHeader && authHeader.startsWith('Bearer ')) {
           const key = authHeader.split(' ')[1];
           const provider = (typeof providerHeader === 'string' ? providerHeader.toLowerCase() : 'groq');
           if (provider.includes('gemini')) apiKeys.geminiKey = key;
           else if (provider.includes('openrouter')) apiKeys.openRouterKey = key;
           else apiKeys.groqKey = key; 
      }

      const result = await suggestFood(req.body, apiKeys);
      res.json(result);
  } catch (error: any) {
      console.error('[HTTP] Suggest Food error:', error);
      res.status(500).json({ error: error.message });
  }
});

app.post('/suggest/non-food', async (req, res) => {
  try {
      console.error(`[HTTP] Non-food suggestion requested`);
      const result = await suggestNonFood(req.body);
      res.json(result);
  } catch (error: any) {
      console.error('[HTTP] Suggest Non-Food error:', error);
      res.status(500).json({ error: error.message });
  }
});

app.post('/decompose/non-food', async (req, res) => {
  try {
      console.error(`[HTTP] Non-food decomposition requested`);
      const authHeader = req.headers.authorization;
      const providerHeader = req.headers['x-ai-provider'];
      
      let apiKeys: any = {};
      let provider = 'groq'; // default
      if (authHeader && authHeader.startsWith('Bearer ')) {
           const key = authHeader.split(' ')[1];
           provider = (typeof providerHeader === 'string' ? providerHeader.toLowerCase() : 'groq');
           if (provider.includes('gemini')) apiKeys.geminiKey = key;
           else if (provider.includes('openrouter')) apiKeys.openRouterKey = key;
           else apiKeys.groqKey = key; 
      }

      const result = await decomposeNonFood(req.body, apiKeys, provider);
      res.json(result);
  } catch (error: any) {
      console.error('[HTTP] Decompose Non-Food error:', error);
      res.status(500).json({ error: error.message });
  }
});

app.listen(HTTP_PORT, () => {
    console.error(`[HTTP] Extraction server running on port ${HTTP_PORT}`);
});

// Define MCP tools
const tools: Tool[] = [
  {
    name: "list_types",
    description: "List all available type definitions (interfaces and types). No authentication required.",
    inputSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description: "Optional filter to search type names",
        },
      },
    },
  },
  {
    name: "get_type_definition",
    description: "Get detailed definition of a specific type. No authentication required.",
    inputSchema: {
      type: "object",
      properties: {
        typeName: {
          type: "string",
          description: "Name of the type to retrieve",
        },
      },
      required: ["typeName"],
    },
  },
  {
    name: "validate_data",
    description: "Validate data against a type definition. No authentication required.",
    inputSchema: {
      type: "object",
      properties: {
        typeName: {
          type: "string",
          description: "Name of the type to validate against",
        },
        data: {
          type: "object",
          description: "Data object to validate",
        },
      },
      required: ["typeName", "data"],
    },
  },
  {
    name: "create_type_from_description",
    description: "Create a new type definition from a natural language description. Requires authentication (admin or user role).",
    inputSchema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Natural language description of the type to create",
        },
        authToken: {
          type: "string",
          description: "JWT authentication token",
        },
      },
      required: ["description", "authToken"],
    },
  },
  {
    name: "add_type_definition",
    description: "Add a new type definition (TypeScript code). Requires authentication (admin or user role).",
    inputSchema: {
      type: "object",
      properties: {
        typeDefinition: {
          type: "string",
          description: "TypeScript type definition to add",
        },
        authToken: {
          type: "string",
          description: "JWT authentication token",
        },
      },
      required: ["typeDefinition", "authToken"],
    },
  },
  {
    name: "query_data",
    description: "Query and filter data based on type structure. No authentication required.",
    inputSchema: {
      type: "object",
      properties: {
        typeName: {
          type: "string",
          description: "Type to query",
        },
        query: {
          type: "object",
          description: "Query filters (field: value pairs)",
        },
      },
      required: ["typeName"],
    },
  },
  {
    name: "generate_report",
    description: "Generate a custom report from type data. No authentication required.",
    inputSchema: {
      type: "object",
      properties: {
        reportType: {
          type: "string",
          description: "Type of report to generate (e.g., 'summary', 'detailed', 'impact')",
        },
        data: {
          type: "object",
          description: "Data to include in report",
        },
        format: {
          type: "string",
          enum: ["json", "markdown", "html"],
          description: "Output format",
        },
      },
      required: ["reportType", "data"],
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: "tm-types-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_types": {
        const content = readTypes();
        const { interfaces, types } = parseTypeDefinitions(content);
        const filter = (args as any).filter?.toLowerCase();
        
        const filteredInterfaces = filter
          ? interfaces.filter((i) => i.name.toLowerCase().includes(filter))
          : interfaces;
        const filteredTypes = filter
          ? types.filter((t) => t.name.toLowerCase().includes(filter))
          : types;
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  interfaces: filteredInterfaces.map((i) => ({
                    name: i.name,
                    extends: i.extends,
                    fieldCount: i.fields.length,
                  })),
                  types: filteredTypes.map((t) => ({
                    name: t.name,
                    definition: t.definition,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_type_definition": {
        const { typeName } = args as any;
        const content = readTypes();
        const { interfaces, types } = parseTypeDefinitions(content);
        
        const interfaceDef = interfaces.find((i) => i.name === typeName);
        const typeDef = types.find((t) => t.name === typeName);
        
        if (!interfaceDef && !typeDef) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: `Type '${typeName}' not found` }),
              },
            ],
            isError: true,
          };
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(interfaceDef || typeDef, null, 2),
            },
          ],
        };
      }

      case "validate_data": {
        const { typeName, data } = args as any;
        const content = readTypes();
        const { interfaces } = parseTypeDefinitions(content);
        
        const typeDef = interfaces.find((i) => i.name === typeName);
        if (!typeDef) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: `Type '${typeName}' not found` }),
              },
            ],
            isError: true,
          };
        }
        
        // Simple validation - check required fields
        const errors: string[] = [];
        for (const field of typeDef.fields) {
          if (!field.optional && !(field.name in data)) {
            errors.push(`Missing required field: ${field.name}`);
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                valid: errors.length === 0,
                errors,
                typeName,
              }, null, 2),
            },
          ],
        };
      }

      case "create_type_from_description": {
        const { description, authToken } = args as any;
        const auth = verifyAuth(authToken);
        
        if (auth.role === "anonymous") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "Authentication required" }),
              },
            ],
            isError: true,
          };
        }
        
        const content = readTypes();
        const newType = await generateTypeFromNL(description, content);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "Type generated successfully. Review and use 'add_type_definition' to add it.",
                generatedType: newType,
              }, null, 2),
            },
          ],
        };
      }

      case "add_type_definition": {
        const { typeDefinition, authToken } = args as any;
        const auth = verifyAuth(authToken);
        
        const oldContent = readTypes();
        const newContent = `${oldContent}\n\n${typeDefinition}\n`;
        writeTypes(newContent, auth);
        
        // Detect changes and update Vue editors
        try {
          const changes = detectChangedInterfaces(oldContent, newContent);
          if (changes.length > 0) {
            updateVueEditors(changes);
            updateTreeView(changes);
          }
        } catch (error: any) {
          console.error(`Error updating editors: ${error.message}`);
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "Type definition added successfully, editors and tree view updated",
                userId: auth.userId,
              }),
            },
          ],
        };
      }

      case "query_data": {
        const { typeName, query } = args as any;
        // This would integrate with your actual data storage
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "Query functionality - integrate with your data store",
                typeName,
                query,
              }, null, 2),
            },
          ],
        };
      }

      case "generate_report": {
        const { reportType, data, format = "json" } = args as any;
        
        // Simple report generation
        let report: string;
        if (format === "markdown") {
          report = `# ${reportType.toUpperCase()} Report\n\n${JSON.stringify(data, null, 2)}`;
        } else if (format === "html") {
          report = `<html><body><h1>${reportType} Report</h1><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;
        } else {
          report = JSON.stringify({ reportType, data }, null, 2);
        }
        
        return {
          content: [
            {
              type: "text",
              text: report,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
          isError: true,
        };
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: error.message }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Trace Market Types MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
