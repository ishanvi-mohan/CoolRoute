import SunCalc from 'suncalc';
const LAT=22.2819, LNG=114.1582;
const times = [
  ['2026-06-13T22:30:00Z','HK 06:30'],
  ['2026-06-14T00:00:00Z','HK 08:00'],
  ['2026-06-14T02:00:00Z','HK 10:00'],
  ['2026-06-14T04:24:00Z','HK 12:24 (solar noon)'],
  ['2026-06-14T08:30:00Z','HK 16:30'],
  ['2026-06-14T10:00:00Z','HK 18:00'],
];
for (const [iso,label] of times){
  const t=new Date(iso); const p=SunCalc.getPosition(t,LAT,LNG);
  const az=(((p.azimuth*180/Math.PI)+180+360)%360); const alt=p.altitude*180/Math.PI;
  console.log(`${label.padEnd(24)} alt=${alt.toFixed(1).padStart(5)}  az=${az.toFixed(1)}`);
}
