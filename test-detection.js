import { detectCodebase } from './src/lib/processor.js';
import path from 'path';

const testDir = path.join(process.cwd(), 'test-strict-detection');

console.log('Testing strict detection on:', testDir);

detectCodebase(testDir).then(result => {
  console.log('Detection result:', result);
  console.log('Expected: Only javascript and typescript (no frameworks)');
}).catch(err => {
  console.error('Error:', err);
});
