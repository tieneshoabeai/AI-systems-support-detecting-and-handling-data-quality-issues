// Tang 9 - Benchmark AI thu cong: node test/benchmark/run-benchmark.mjs --model=M1 --set=eval-set.jsonl
// Quy tac: mau benchmark KHONG nam trong kho feedback_example; temperature=0.2/top_p=0.9/seed co dinh; chay 3 lan.
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const model = args.model ?? 'M1';
const setFile = args.set ?? 'test/benchmark/eval-set.jsonl';
console.log(`[benchmark] model=${model} set=${setFile}`);
if (!fs.existsSync(setFile)) {
  console.log('[benchmark] chua co eval-set.jsonl mau - tao file mau 5 dong de chay thu (can thay bang 150-200 mau that truoc khi chot production)');
  fs.mkdirSync('test/benchmark', { recursive: true });
  fs.writeFileSync(setFile, Array.from({ length: 5 }, (_, i) => JSON.stringify({ id: `s${i}`, dq: `DQ-0${(i % 5) + 1}`, label: i % 2 ? 'false_positive' : 'true_positive', text_vi: `Mau tieng Viet ${i}` })).join('\n') + '\n');
}
const lines = fs.readFileSync(setFile, 'utf-8').trim().split('\n').filter(Boolean);
console.log(`[benchmark] tong mau: ${lines.length}`);
const out = `../../docs/test-reports/benchmark-${model}-${new Date().toISOString().slice(0, 10)}.md`;
fs.mkdirSync('../../docs/test-reports', { recursive: true });
fs.writeFileSync(out, `# Benchmark ${model} - ${new Date().toISOString()}\n\n- Tong mau: ${lines.length}\n- Trang thai: CHAY THU (can chay that voi engine + du 9 chi so truoc khi chot production)\n- Nguong: F1>=0.75, JSON>=98%, ao giac<=2%, vi>=4.0, p95<=180s, tok/s>=4, RSS<=11GB, loi<=2%\n`);
console.log(`[benchmark] da ghi ${out}`);
