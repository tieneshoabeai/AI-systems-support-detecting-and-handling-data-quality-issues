/**
 * So sánh 2 model theo quy tắc §3.15.5 Bước 4: McNemar + Wilcoxon + ΔF1 ≥ 0,03.
 *
 *   pnpm run bench:stats -- --a=M1 --b=M3 [--judgeModel=qwen3:14b]
 *
 * Đọc kết quả từ các file báo cáo JSON mà runner ghi ra
 * (`docs/test-reports/benchmark-<model>-<ngày>.json`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { compareModels, MIN_F1_DELTA } from './stats';

interface StoredRun {
  candidateId: string;
  ollama: string;
  think: boolean;
  scored: {
    sampleId: string;
    truthPositive: boolean;
    predPositive: boolean;
    correct: boolean;
    judgeScore: number | null;
  }[];
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    }),
);

const reportDir = path.resolve(process.cwd(), '../../docs/test-reports');

function loadRuns(): StoredRun[] {
  if (!fs.existsSync(reportDir)) return [];
  return fs
    .readdirSync(reportDir)
    .filter((f) => /^benchmark-M\d-.*\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(path.join(reportDir, f), 'utf8')) as StoredRun);
}

const runs = loadRuns();
if (runs.length < 2) {
  console.error('Can it nhat 2 file ket qua benchmark (docs/test-reports/benchmark-M*.json).');
  process.exitCode = 1;
} else {
  const aId = typeof args['a'] === 'string' ? args['a'] : runs[0]?.candidateId;
  const bId = typeof args['b'] === 'string' ? args['b'] : runs[1]?.candidateId;
  const a = runs.find((r) => r.candidateId === aId);
  const b = runs.find((r) => r.candidateId === bId);
  if (!a || !b) {
    console.error(`Khong tim thay ${aId} hoac ${bId}.`);
    process.exitCode = 1;
  } else {
    const index = new Map(b.scored.map((s) => [s.sampleId, s]));
    const aCorrect: boolean[] = [];
    const bCorrect: boolean[] = [];
    const aTruth: boolean[] = [];
    const aPred: boolean[] = [];
    const bTruth: boolean[] = [];
    const bPred: boolean[] = [];
    const judgeA: number[] = [];
    const judgeB: number[] = [];
    for (const s of a.scored) {
      const other = index.get(s.sampleId);
      if (!other) continue;
      aCorrect.push(s.correct);
      bCorrect.push(other.correct);
      aTruth.push(s.truthPositive);
      aPred.push(s.predPositive);
      bTruth.push(other.truthPositive);
      bPred.push(other.predPositive);
      if (s.judgeScore !== null && other.judgeScore !== null) {
        judgeA.push(s.judgeScore);
        judgeB.push(other.judgeScore);
      }
    }
    const verdict = compareModels(aCorrect, bCorrect, judgeA, judgeB, {
      aTruth,
      aPred,
      bTruth,
      bPred,
    });
    console.log(`=== SO SANH ${a.candidateId} (${a.ollama}) vs ${b.candidateId} (${b.ollama}) ===`);
    console.log(`So mau chung: ${aCorrect.length}`);
    console.log(`McNemar: b=${verdict.mcnemar.b} c=${verdict.mcnemar.c} p=${verdict.mcnemar.pValue.toFixed(4)}`);
    if (verdict.wilcoxon) {
      console.log(
        `Wilcoxon: W+=${verdict.wilcoxon.wPlus} W-=${verdict.wilcoxon.wMinus} p=${verdict.wilcoxon.pValue.toFixed(4)} medianDiff=${verdict.wilcoxon.medianDiff}`,
      );
    }
    console.log(`ΔF1 = ${verdict.deltaF1.toFixed(3)} (nguong khac biet: ${MIN_F1_DELTA})`);
    console.log(`Ket luan: ${verdict.reason}`);
    console.log(
      verdict.canDeclareWinner
        ? `-> TUYEN BO THANG: ${verdict.winner}`
        : '-> KHONG DU DIEU KIEN TUYEN BO THANG (chuyen sang so chi so #3-#9)',
    );
  }
}
