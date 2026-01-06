#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to types definition file
const TYPES_PATH = join(__dirname, "../../../src/index.d.ts");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

interface AuthContext {
  userId?: string;
  role?: "admin" | "user" | "anonymous";
}

// Authentication helper
function verifyAuth(token?: string): AuthContext {
  if (!token) {
    return { role: "anonymous" };
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
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
    throw new Error("Types file not found");
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
        
        const content = readTypes();
        const newContent = `${content}\n\n${typeDefinition}\n`;
        writeTypes(newContent, auth);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "Type definition added successfully",
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
