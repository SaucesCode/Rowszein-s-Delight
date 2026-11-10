// Real application helper; only the clock is controlled. No application edits.
const RealDate = Date;
let instant = '2026-11-10T04:00:00Z';
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [instant])); }
  static now() { return new RealDate(instant).getTime(); }
};
const {getDateRange} = await import('../../frontend/src/lib/dateRanges.ts');
const evidence=[];
for (const [clock,period,expected] of [
  ['2026-11-10T04:00:00Z','this_month',{date_from:'2026-11-01',date_to:'2026-11-10'}],
  ['2026-11-09T23:00:00Z','today',{date_from:'2026-11-10',date_to:'2026-11-10'}],
  ['2026-11-09T23:00:00Z','this_week',{date_from:'2026-11-09',date_to:'2026-11-10'}],
]) {
  instant=clock;
  const actual=getDateRange(period);
  evidence.push({clock,zone:Intl.DateTimeFormat().resolvedOptions().timeZone,period,expected,actual,
    desired_behavior_passed:JSON.stringify(actual)===JSON.stringify(expected)});
}
console.log(JSON.stringify(evidence,null,2));
process.exitCode=evidence.every(row=>row.desired_behavior_passed)?0:1;
