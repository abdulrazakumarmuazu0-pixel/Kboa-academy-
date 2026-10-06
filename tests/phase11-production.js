const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const required=[
 ['.github/workflows/deploy-production.yml',['KBOA_ALERT_WEBHOOK_URL','KBOA_BACKUP_LAST_VERIFIED_AT','functions/.env.production','test:phase11']],
 ['tests/deployment-gate.js',['KBOA_ALERT_WEBHOOK_URL','KBOA_BACKUP_LAST_VERIFIED_AT','26 * 60 * 60 * 1000']],
 ['functions/.env.example',['PAYSTACK_SECRET_KEY','KBOA_ALERT_WEBHOOK_URL']]
];
for(const [f,items] of required){const t=read(f);for(const x of items)if(!t.includes(x))throw new Error(`${f} missing ${x}`)}
console.log('Phase 11 production deployment gate contract: PASS');
