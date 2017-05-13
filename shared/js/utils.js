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
    ON_WIN: 'on_win',
    ON_LOSE: 'on_lose'
  }

  exports.CellTypes = {
    EMPTY: 'empty',
    SHIP: 'ship',
    MISS: 'miss',
    HIT: 'hit'
  }

  exports.cellStyle = function (cellType) {
    var mapping = {}
    mapping[exports.CellTypes.EMPTY] = 'bg-info'
    mapping[exports.CellTypes.SHIP] = 'bg-primary'
    mapping[exports.CellTypes.MISS] = 'bg-info'
    mapping[exports.CellTypes.HIT] = 'bg-primary'

    return mapping[cellType]
  }

  exports.Directions = {
    HOR: 'hor',
    VER: 'ver'
  }

  exports.LocalBoardId = 'local-board'
  exports.RemoteBoardId = 'remote-board'
  exports.localCellSelectors = function (cellId) {
    return {
      div: 'local-div-' + cellId,
      svg: 'local-svg-' + cellId
    }
  }
  exports.remoteCellSelectors = function (cellId) {
    return {
      div: 'remote-div-' + cellId,
      svg: 'remote-svg-' + cellId
    }
  }

  exports.renderFleet = function (fleet) {
    var canvas = exports.emptyFleet()

    fleet.forEach(function (ship) {
      var d = exports.pointFromDirection(ship.direction)

      for (var i = 0; i < ship.length; i++) {
        var p = exports.pointSum(ship, exports.pointScale(d, i))
        canvas[p.y * 10 + p.x] = exports.CellTypes.SHIP
      }
    })

    return canvas
  }

  /* the descending order is retained for the relaxing arrangement */
  exports.shipLengths = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]

  exports.pointFromDirection = function (direction) {
    return {
      x: direction === exports.Directions.HOR ? 1 : 0,
      y: direction === exports.Directions.VER ? 1 : 0
    }
  }

  exports.pointSum = function (p, d) {
    return {
      x: p.x + d.x,
      y: p.y + d.y
    }
  }

  exports.pointScale = function (p, k) {
    return {
      x: p.x * k,
      y: p.y * k
    }
  }

  exports.isCorrectPointLocation = function (p) {
    return p.x >= 0 && p.x < 10 && p.y >= 0 && p.y < 10
  }

  exports.shipTail = function(ship) {
    var d = exports.pointFromDirection(ship.direction)
    var tail = exports.pointSum(ship, exports.pointScale(d, ship.length - 1))
    return tail
  }

  exports.isCorrectShipLocation = function (ship) {
    return exports.isCorrectPointLocation(ship) && exports.isCorrectPointLocation(exports.shipTail(ship))
  }

  exports.isPointColliding = function (p, canvas) {
    var dArray = [{ x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
                  { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 },
                  { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 }
    ]

    for (var i = 0; i < dArray.length; i++) {
      var d = dArray[i]
      var tmpP = exports.pointSum(p, d)
      if (!exports.isCorrectPointLocation(tmpP)) {
        continue
      }

      if (canvas[tmpP.y * 10 + tmpP.x] !== exports.CellTypes.EMPTY) {
        return true
      }
    }

    return false
  }

  exports.isShipColliding = function (ship, fleet) {
    var canvas = exports.renderFleet(fleet)
    var d = exports.pointFromDirection(ship.direction)

    for (var i = 0; i < ship.length; i++) {
      var p = exports.pointSum(ship, exports.pointScale(d, i))
      if (exports.isPointColliding(p, canvas)) {
        return true
      }
    }

    return false
  }

  exports.emptyFleet = function () {
    var result = []
    for (var i = 0; i < 100; i++)
      result.push(exports.CellTypes.EMPTY)
    return result
  }

  exports.createFleet = function () {
    var fleet = []

    exports.shipLengths.forEach(function (length) {
      var positions = []
      for (var i = 0; i < 100; i++) {
        positions.push(i)
      }

      var ship = null

      while (!ship) {
        var idx = Math.floor(Math.random() * positions.length)
        var position = positions[idx]
        positions.splice(idx, 1)

        var direction = Math.random() > 0.5 ? exports.Directions.VER : exports.Directions.HOR
        var y = Math.floor(position / 10)
        var x = position - y * 10

        var tmpShip = {
          x: x,
          y: y,
          length: length,
          direction: direction
        }

        if (!exports.isCorrectShipLocation(tmpShip)) {
          continue
        }

        if (exports.isShipColliding(tmpShip, fleet)) {
          continue
        }

        ship = tmpShip
      }

      fleet.push(ship)
    })

    return fleet
  }

})(typeof exports === 'undefined' ? this['utils'] = {} : exports)
