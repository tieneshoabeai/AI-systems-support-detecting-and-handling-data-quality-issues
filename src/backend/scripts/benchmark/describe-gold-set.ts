/**
 * In phân bổ tập dữ liệu vàng — kiểm tra độ phủ trước mỗi lần chạy benchmark.
 *
 *   pnpm run bench:gold
 */
import { describeGoldSet, generateGoldSet } from './gold-set';
import { GOLD_SIZE } from './models';

const samples = generateGoldSet(GOLD_SIZE);
const d = describeGoldSet(samples);

console.log(`=== TAP DU LIEU VANG (${d.total} mau) ===`);
console.log('');
console.log('Phan bo loai mau:');
for (const [k, v] of Object.entries(d.byKind)) {
  console.log(`  ${k.padEnd(8)} ${String(v).padStart(4)}  (${((v / d.total) * 100).toFixed(1)}%)`);
}
console.log('');
console.log('Phan bo muc anh huong:');
for (const [k, v] of Object.entries(d.bySeverity)) {
  console.log(`  ${k.padEnd(8)} ${String(v).padStart(4)}`);
}
console.log('');
console.log('Phan bo loai loi DQ:');
for (const [k, v] of Object.entries(d.byCode)) {
  console.log(`  ${k.padEnd(8)} ${String(v).padStart(4)}`);
}
console.log('');
console.log('Mau bay (trap):');
for (const [k, v] of Object.entries(d.byTrap)) {
  console.log(`  ${k.padEnd(16)} ${String(v).padStart(4)}`);
}
console.log('');
console.log(`Tong so cap tuong quan ky vong: ${d.totalExpectedPairs}`);
console.log(`Tong so cot VIF vuot nguong:      ${d.totalExpectedHighVif}`);
console.log(`Mau sach (khong co van de):      ${d.cleanSamples}`);
console.log('');

const ok =
  d.total >= 150 &&
  Object.keys(d.bySeverity).length === 3 &&
  Object.keys(d.byCode).length >= 4 &&
  (d.byTrap['false_positive'] ?? 0) > 0 &&
  (d.byTrap['missed_issue'] ?? 0) > 0;
console.log(ok ? 'DO PHU OK' : 'DO PHU KHONG DU — can sua bo sinh mau');
if (!ok) process.exitCode = 1;
