'use strict';

function DefaultProcessor(cube) {
  this.cube = cube;
}

DefaultProcessor.type = '*';
DefaultProcessor.ext = '*';

DefaultProcessor.prototype = {
  process: function (data, callback) {
    data.code = 'module.exports = function () {return ' + JSON.stringify(data.code) + ';}';
    callback(null, data);
  }
};

module.exports = DefaultProcessor;
