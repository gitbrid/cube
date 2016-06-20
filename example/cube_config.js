'use strict';

module.exports = {
  processors: {
    '.jsx': ['cube-react'],
    '.less': ['cube-less'],
    '.styl': ['cube-stylus'],
    '.coffee': ['cube-coffee'],
    '.ejs': ['cube-ejs'],
    '.jade': ['cube-jade']
  },
  build: {
    ignore: [

    ],
    skip: [

    ]
  }
};