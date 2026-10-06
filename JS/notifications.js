/* KBOA Production Notifications + XP client */
(function(){
  async function call(name, data){
    if(!window.firebase || !firebase.functions) throw new Error('Firebase Functions is not available.');
    return (await firebase.functions().httpsCallable(name)(data || {})).data;
  }
  async function getNotifications(limit){ return call('getMyNotifications',{limit:limit||30}); }
  async function markRead(id){ return call('markNotificationRead',{notificationId:id}); }
  async function getXp(){ return call('getMyXp',{}); }
  window.KboaNotifications={getNotifications,markRead,getXp,call};
})();
