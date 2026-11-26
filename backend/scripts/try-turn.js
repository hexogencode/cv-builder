// Quick backend test without UI:
//   npm run try -w backend -- "I'm Alex, I study AI at JKU Linz since 2024"
import { runTurn } from '../src/gemini.js';

const userMessage = process.argv.slice(2).join(' ');
const result = await runTurn({ cv: {}, recentMessages: [], userMessage });
console.log(JSON.stringify(result, null, 2));
