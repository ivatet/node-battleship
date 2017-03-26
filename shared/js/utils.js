(function (exports) {
  exports.ClientRequests = {
    ON_JOIN: 'on_join',
    ON_ATTACK: 'on_attack'
  };

  exports.ServerResponses = {
    ON_ACCEPT: 'on_accept',
    ON_REJECT: 'on_reject',
    ON_ATTACK: 'on_attack',
    ON_DEFEND: 'on_reject',
    ON_FINISH: 'on_finish'
  };
})(typeof exports === 'undefined' ? window.utils = {} : exports);
