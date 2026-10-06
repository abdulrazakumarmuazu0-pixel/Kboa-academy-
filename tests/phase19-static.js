const fs=require('fs'); const path=require('path');
const root=path.resolve(__dirname,'..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
const fn=read('functions/index.js'); const rules=read('firestore.rules'); const pkg=JSON.parse(read('package.json'));
const required=['trackAnalyticsEvent','searchCourses','getAnalyticsReport','getOperationalReport','rebuildSearchIndex','scheduledAnalyticsMaintenance'];
for(const name of required) if(!fn.includes(`exports.${name}`)) throw new Error(`Missing ${name}`);
for(const x of ['analytics_events','analytics_daily','course_search']) if(!rules.includes(`match /${x}/{id}`)) throw new Error(`Missing rules for ${x}`);
for(const x of ['test:phase19']) if(!pkg.scripts[x]) throw new Error(`Missing script ${x}`);
if(!fn.includes("ANALYTICS_EVENT_TYPES")||!fn.includes('aggregateReport')||!fn.includes('tokenizeSearch')) throw new Error('Analytics/search core missing');
console.log('Phase 19 static gate: PASS');
