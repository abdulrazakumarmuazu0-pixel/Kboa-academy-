// KBOA Production Client Error Reporter
(function(){
  var recent = {};
  function fingerprint(message, page){ return String(message||'').slice(0,180)+'|'+String(page||''); }
  function report(error, severity){
    try {
      var message = error && error.message ? error.message : String(error || 'Unknown error');
      var page = location.pathname;
      var key = fingerprint(message,page);
      if (recent[key]) return;
      recent[key] = Date.now();
      setTimeout(function(){ delete recent[key]; }, 60000);
      if (window.firebase && firebase.functions) {
        firebase.functions().httpsCallable('reportClientError')({
          message: message,
          stack: error && error.stack ? String(error.stack).slice(0,5000) : '',
          page: page,
          severity: severity || 'error'
        }).catch(function(){});
      }
    } catch (_) {}
  }
  window.KboaErrorReporter = { report: report };
  window.addEventListener('error', function(e){ report(e.error || e.message, 'error'); });
  window.addEventListener('unhandledrejection', function(e){ report(e.reason || 'Unhandled promise rejection', 'error'); });
})();
