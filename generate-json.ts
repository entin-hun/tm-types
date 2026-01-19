import { typeDescriptions } from './src/descriptions';
import * as fs from 'fs';
import * as path from 'path';

// Extract just the fields needed for the client
const output = JSON.stringify(typeDescriptions, null, 2);
fs.writeFileSync(path.join(__dirname, 'src/descriptions.json'), output);
console.log('Generated src/descriptions.json');
