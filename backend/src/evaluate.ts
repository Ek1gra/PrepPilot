import fs from 'fs';
import path from 'path';
import { runPrepKitPipeline } from './pipeline/orchestrator';
import { BatchCaseInput, BatchCaseOutput, BatchOutput } from './types/kit';

function parseArgs(args: string[]): { input: string; output: string } {
  const result = { input: '', output: '' };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--input') result.input = args[++i] || '';
    else if (args[i] === '--output') result.output = args[++i] || '';
    else if (args[i].startsWith('--input=')) result.input = args[i].slice(8);
    else if (args[i].startsWith('--output=')) result.output = args[i].slice(9);
  }
  if (!result.input && args.length >= 2 && !args[0].startsWith('--') && !args[1].startsWith('--')) {
    result.input = args[0];
    result.output = args[1];
  }
  return result;
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));
  if (!input || !output) throw new Error('Usage: npm run evaluate -- --input <cases.json> --output <kits.json>');

  const inputPath = path.resolve(process.cwd(), input);
  const outputPath = path.resolve(process.cwd(), output);
  const cases = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as BatchCaseInput[];
  if (!Array.isArray(cases)) throw new Error('Input must be an array of cases');

  const results: BatchCaseOutput[] = [];
  for (const item of cases) {
    try {
      const kit = await runPrepKitPipeline({ jd: item.jd, company_url: item.company_url, days: item.days });
      results.push({ id: item.id, status: 'ok', kit, error: null });
    } catch (error: any) {
      results.push({ id: item.id, status: 'failed', kit: null, error: { code: error?.code || 'PIPELINE_ERROR', message: error?.message || 'Pipeline failed' } });
    }
  }

  const outputData: BatchOutput = { version: '1.0', generated_at: new Date().toISOString(), kits: results };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
