import fs from 'node:fs';
const file = new URL('../../openapi/sigac-v1.yaml', import.meta.url);
if (!fs.readFileSync(file, 'utf8').includes('openapi: 3.1.0')) {
  throw new Error('OpenAPI contract missing/invalid bootstrap header');
}
console.log('OpenAPI bootstrap validation OK');
