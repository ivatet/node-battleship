(function (exports) {
  exports.ClientRequests = {
    ON_JOIN: 'on_join',
    ON_ATTACK: 'on_attack'
  }

  exports.ServerResponses = {
    ON_ACCEPT: 'on_accept',
    ON_REJECT: 'on_reject',
    ON_ATTACK: 'on_attack',
    ON_DEFEND: 'on_defend',
    ON_FINISH: 'on_finish'
  }

  exports.CellTypes = {
    EMPTY: 'empty',
    SHIP: 'ship'
  }

  exports.cellStyle = function (cellType) {
    var mapping = {}
    mapping[exports.CellTypes.EMPTY] = 'bg-info'
    mapping[exports.CellTypes.SHIP] = 'bg-primary'

    return mapping[cellType]
  }

  exports.Directions = {
    HOR: 'hor',
    VER: 'ver'
  }
})(typeof exports === 'undefined' ? window.utils = {} : exports)
