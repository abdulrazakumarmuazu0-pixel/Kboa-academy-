const fs=require('fs'), cp=require('child_process'), path=require('path');
const root=path.resolve(__dirname,'..');
const js=['functions/index.js','js/auth.js','js/data.js','js/certificates/certificate-generator.js','js/native-bridge.js','js/notifications.js','admin/js/admin-data.js'];
for(const f of js){cp.execFileSync(process.execPath,['--check',path.join(root,f)],{stdio:'inherit'});}
for(const f of ['firestore.rules','storage.rules','firebase.json','firestore.indexes.json']) if(!fs.existsSync(path.join(root,f))) throw new Error(`Missing ${f}`);
const fn=fs.readFileSync(path.join(root,'functions/index.js'),'utf8');
for(const marker of ['exports.registerPushToken','exports.removePushToken','exports.getMyNotifications','exports.markNotificationRead','exports.sendNotification','exports.getMyXp']) if(!fn.includes(marker)) throw new Error(`Missing ${marker}`);
const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
if(!rules.includes('match /push_tokens/{id}') || !rules.includes('allow read, write: if false')) throw new Error('Push token rules missing');
if(!fs.existsSync(path.join(root,'admin/notifications.html'))) throw new Error('Admin notifications UI missing');
console.log('Phase 4 static production checks: PASS');
