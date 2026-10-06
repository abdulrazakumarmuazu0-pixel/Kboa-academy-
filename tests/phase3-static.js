const fs=require('fs'), cp=require('child_process'), path=require('path');
const root=path.resolve(__dirname,'..');
const js=['functions/index.js','js/auth.js','js/data.js','js/certificates/certificate-generator.js','admin/js/admin-data.js'];
for(const f of js){cp.execFileSync(process.execPath,['--check',path.join(root,f)],{stdio:'inherit'});}
for(const f of ['firestore.rules','storage.rules','firebase.json','firestore.indexes.json']){
 if(!fs.existsSync(path.join(root,f))) throw new Error(`Missing ${f}`);
}
const rules=fs.readFileSync(path.join(root,'storage.rules'),'utf8');
if(!rules.includes('match /course-assets/{courseId}/{assetType}/{fileName=**}')||!rules.includes('allow read: if false')) throw new Error('Secure course-assets storage rule missing');
const fn=fs.readFileSync(path.join(root,'functions/index.js'),'utf8');
for(const marker of ['exports.getCourseAssetUrl','exports.createAdmissionApplication','exports.updateAdmissionApplication','exports.getAuditLogs','exports.paystackWebhook']) if(!fn.includes(marker)) throw new Error(`Missing function ${marker}`);
console.log('Phase 3 static production checks: PASS');
