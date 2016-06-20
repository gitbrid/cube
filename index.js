/*!
 * cube: index.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var utils = require('./lib/utils');
var wraper = require('./lib/wraper');
var path = require('path');
var debug = require('debug')('cube:init');


function loadDefaultProcessor(cube) {
  cube.register('.js', path.join(__dirname, './lib/processor_js'));
  cube.register('.css', path.join(__dirname, './lib/processor_css'));
  cube.register('.html', path.join(__dirname, './lib/processor_html'));
}
/**
 * [Cube description]
 * @param {Object} config
 *        ## for cli useage
 *        - root {Path}
 *        - port {String} [optional] server port
 *        - router {String} [optional] set the app.use(`$router`, cube_middleware)
 *
 *        - release {Boolean} if build project, set true
 *        - processors {Array} [optional] set the extenal processors
 *        - resBase {String} [optional] the http base for resource
 *        - devCache {Boolean} default true
 *        - withDist {Boolean} switch if search module dist dir 已废弃
 *        - merge {Boolean} if merge all file into one file
 *        - mangleFileName {Boolean}
 *        - mangleFileNameIgnore {Array}
 *        - built {Boolean}
 *        - moduleMap {Object} 映射模块寻址路径
 *        - forceRequire {Boolean} 是否强制 require, 即使require的内容不存在
 */
function Cube(config) {
  // remove the last slash(\|/) in config.root
  config.root = config.root.replace(/[\\\/]$/, '');
  /**
   * processor mapping
   * @type {Object}
   *       {
   *         // from ext to type
   *         map: {
   *           '.js': 'script'
   *         },
   *         types: {
   *           script: {
   *             '.js': ['js_processor'],
   *             '.coffee': ['js_processor']
   *           },
   *           style: {
   *             '.css': ['css_processor'],
   *             '.less': ['less_processor']
   *           },
   *           template: {
   *             '.jade': ['tpl_processor'],
   *             '.ejs': ['tpl_processor']
   *           }
   *         }
   *       }
   */
  if (config.compress === undefined) {
    config.compress = false;
  }
  if (config.devCache === undefined) {
    config.devCache = true;
  }
  if (!config.router) {
    config.router = '/';
  }
  if (!config.hooks) {
    config.hooks = {};
  }

  this.config = config;

  this.CACHE = {};
  this.caches = {
    _cache: {},
    get: function (key) {
      if (!this._cache[key]) {
        this._cache[key] = {};
      }
      return this._cache[key];
    }
  };

  this.processors = {
    map: {
      // sufix: type
    },
    types: {
      script: {},
      style: {},
      template: {}
    }
  };
  this.mimeType = {
    'script': 'application/javascript',
    'style': 'text/css',
    'template': 'text/html'
  };

  debug('loading default process');
  loadDefaultProcessor(this);
  var self = this;
  if (config.processors) {
    console.error('==============');
    console.error('[ERROR] cube do not support processors property');
    console.error('==============');
    return;
  }
  // load ignore
  // this.ignoresRules = utils.loadIgnore(config.root);

  this.ignoresRules = {
    ignore: [],
    skip: []
  };

  // loading configs from package.json:cube
  var root = config.root;
  var cfg;
  try {
    cfg = require(path.join(root, './cube_config'));
    console.log('[INFO] find cube_config');
  } catch (e) {
    console.error('==============');
    console.error('[ERROR] cube_config not found, init cube failed');
    console.error('==============');
    return;
  }
  if (!cfg || Object.keys(cfg).length <= 0) {
    console.error('==============');
    console.error('[ERROR] cube_config is empty, init cube failed');
    console.error('==============');
    return;
  }


  Object.keys(cfg).forEach(function (key) {
    var prop = cfg[key];
    switch (key) {
      case 'processors':
        Object.keys(prop).forEach(function (ext) {
          var plist = prop[ext];
          if (!Array.isArray(plist)) {
            plist = [plist];
          }
          self.register(ext, plist);
        });
        break;
      case 'build':
        prop.skip && prop.skip.forEach(function (v) {
          if (!v) {
            return ;
          }
          self.ignoresRules.skip.push(utils.genRule(v));
        });
        prop.ignore && prop.ignore.forEach(function (v) {
          if (!v) {
            return ;
          }
          self.ignoresRules.ignore.push(utils.genRule(v));
        });
        break;
    }
    config[key] = prop;
  });
  console.log('>>', this.processors.types);
}
/**
 *
 * @param  {Object} config
 *         - port       listen port [optional]
 *         - connect    the connect object
 *         - root       {Path} static root
 *         - service    {Boolean} start cube as a service, default false, and return a middleware
 *         - processors {Array} extenal processors
 *         - cached     {Path} the cached path
 *         - built      {Boolean} if root path is built code
 *
 */
Cube.init = function (config) {
  var cube = new Cube(config);
  var service = require('./service');
  service.init(cube);
  if (config.service) {
    return cube;
  }
  return cube.middleware;
};

/**
 * 获取工具包
 */
Cube.getTool = function () {
  return require('./tools');
};
/**
 * 获取文件类型
 */
Cube.prototype.getType = function (fpath) {
  var ext = fpath.match(/\.\w+$/);
  if (!ext) {
    return null;
  }
  ext = ext[0];
  return this.processors.map[ext];
};
/**
 * 检查排除列表
 * @param  {[type]} absPath [description]
 * @return {[type]}         [description]
 */
Cube.prototype.checkIgnore = function (absPath) {
  // console.log(absPath.substr(this.config.root.length), this.ignoresRules);
  var res = utils.checkIgnore(absPath.substr(this.config.root.length), this.ignoresRules);
  // console.log(res);
  return res.ignore;
};

/**
 * 注册processor
 *
 * @param {String} ext 后缀名
 * @param {Array} ps processor列表, 可以是 Array<String>, 也可以是 Array<ModuleObject>
 *
 * @example   '.js'  [['cube-es2015', {/* config *\/}], 'cube-react']
 */
Cube.prototype.register = function (ext, ps) {
  var processors = this.processors;
  var type;
  try {
    ps = prepareProcessor(this.config.root, ps, ext);
  } catch (e) {
    return console.error(e.message);
  }
  type = ps.type;
  /*
  type = Processor.type || (Processor.info ? Processor.info.type : '');
  if (!ext) {
    ext = Processor.ext || (Processor.info ? Processor.info.ext : '');
  }
  */
  var types = processors.types[type];
  if (!types) {
    types = processors.types[type] = {};
  }

  if (!processors.map[ext]) {
    processors.map[ext] = type;
  }
  if (!types[ext]) {
    types[ext] = [];
  }
  // if (!origin) {
  //   types[ext] = [];
  //   console.log('[WARN] ' + ext + ' already register:' + getProcessNames(origin));
  //   console.log('[WARN] ' + ext + ' now register:' + getProcessNames(ps.processors));
  // }
  var processInstances = [];
  var self = this;
  ps.processors.forEach(function (p) {
    processInstances.push(new p(self));
  });

  if (ext === '*') {
    Object.keys(types).forEach(function (key) {
      types[key] = types[key].concat(processInstances);
    });
  } else {
    types[ext] = types[ext].concat(processInstances);
  }

  Object.keys(types).forEach(function (key) {
    types[key] = uniqueProcessors(types[key]);
  });
};

function uniqueProcessors(list) {
  var res = [];
  var map = {};
  list.forEach(function (n) {
    var name = n.constructor.name;
    if (map[name]) {
      return;
    }
    map[name] = true;
    res.push(n);
  });
  return res;
}

function getProcessNames(processor) {
  var res = [];
  if (Array.isArray(processor)) {
    processor.forEach(function (p) {
      res.push(p.name);
    });
  } else {
    res.push(processor.name);
  }
  return res.join('|');
}
/**
 * 检查processors 配置
 * @param  {String|Array} processor
 * @param  {String} ext the file extname
 * @return {[type]}           [description]
 */
function prepareProcessor(root, processor, ext) {
  var res = [];
  if (!Array.isArray(processor)) {
    processor = [processor];
  }
  var type = null;
  var processorList = [];
  utils.fixProcessorPath(root, processor);
  processor.forEach(function (mod) {
    var p;
    if (!mod) {
      return;
    }
    if (typeof mod === 'string') {
      try {
        p = require(mod);
      } catch (e) {
        throw new Error('[CUBE_ERROR] load processor error:' + e.message);
      }
    } else {
      p = mod;
    }
    if (!ext) {
      ext = p.ext;
    }
    processorList.push(p.name);
    if (!p.type || !p.ext || !p.prototype.process) {
      throw new Error('[CUBE_ERROR] process error');
    }
    if (type === null) {
      type = p.type;
    } else {
      if (type !== p.type) {
        throw new Error('[CUBE_ERROR] more then one type of process find in `' + ext + '` config, processors:' + processorList.join(',') + ' types:' + type + ',' + p.type);
      }
    }
    res.push(p);
  });
  return {type: type, ext: ext, processors: res};
}

Cube.prototype.getMIMEType = function (type) {
  var defaultMime = 'text/plain';
  return this.mimeType[type] || defaultMime;
};

var fileNameMaps = {};
var count = 97;
var prefix = [];

function genName() {
  //97 ~ 122 a-z
  var lastPrefixIndex = prefix.length ? prefix.length - 1 : 0;
  var lastPrefix = prefix[lastPrefixIndex];
  if (count === 123) {
    count = 97;
    if (!lastPrefix) {
      lastPrefix = 97;
    } else {
      lastPrefix += 1;
    }
    if (lastPrefix === 123) {
      lastPrefix -= 1;
      prefix.push(97);
    }
    prefix[lastPrefixIndex] = lastPrefix;
  }
  var value = '';
  prefix.forEach(function (v) {
    if (v) {
      value += String.fromCharCode(v);
    }
  });
  value += String.fromCharCode(count);
  count ++;
  return value;
}
Cube.prototype.printFileShortNameMap = function () {
  console.log(fileNameMaps);
};

Cube.prototype.getFileShortNameMap = function () {
  return fileNameMaps;
};

Cube.prototype.getFileShortName = function (fileName) {
  var mangleFileNameIgnore = this.config.mangleFileNameIgnore;
  if (fileName.indexOf('/') !== 0) {
    return fileName;
  }
  if (mangleFileNameIgnore && mangleFileNameIgnore.indexOf(fileName) >= 0) {
    return fileName;
  }
  if (fileNameMaps[fileName]) {
    return fileNameMaps[fileName];
  }
  var alias = genName();
  /*
  if (!merge) {
    alias = '/' + alias + '.js';
  }
  */
  fileNameMaps[fileName] = alias;
  return alias;
};

/** 修订css文件中的资源文件中的路径 **/
Cube.prototype.fixupResPath = function (dir, code) {
  var base = this.config.resBase || '';
  return code.replace(/url\( *([\'\"]*)([^\'\"\)]+)\1 *\)/ig, function (m0, m1, m2) {
    if (!m2) {
      return m0; // url() content is empty, do nothing
    }
    m2 = m2.trim();
    if (m2.indexOf('data:') === 0) { // url() is a base64 coded resource, ignore
      return m0;
    }
    if (m2.indexOf('/') === 0 || /https?:\/\//.test(m2)) {
      return m0.replace(/\"|\'/g, ''); // url() is pointer to a abs path resource
    }
    var tmp = path.join(base, dir, m2);
    return 'url(' + tmp.replace(/\\/g, '/') + ')';
  });
};

/** 修订css文件中的资源文件中的路径 **/
Cube.prototype.fixStyleResPath = function (dir, code) {
  var base = this.config.resBase || '';
  var deps = [];
  code = code.replace(/url\( *([\'\"]*)([^\'\"\)]+)\1 *\)/ig, function (m0, m1, m2) {
    if (!m2) {
      return m0; // url() content is empty, do nothing
    }
    m2 = m2.trim();
    var st = 0;
    var end = m2.length;
    if (m2[0] === '\'' || m2[0] === '"') {
      st = 1;
    }
    if (m2[m2.length - 1] === '\'' || m2[m2.length - 1] === '"') {
      end = end - 1;
    }
    m2 = m2.substring(st, end);
    if (m2.indexOf('data:') === 0) { // url() is a base64 coded resource, ignore
      return m0;
    }
    if (m2.indexOf('http') === 0) { // url() is a remote resource, ignore
      return m0;
    }
    if (m2.indexOf('/') === 0) {
      deps.push(m2);
      return m0.replace(/\"|\'/g, ''); // url() is pointer to a abs path resource
    }
    var tmp = path.join(base, dir, m2);
    deps.push(path.join(dir, m2));
    return 'url(' + tmp.replace(/\\/g, '/') + ')';
  });
};

Cube.prototype.processJsCode = function (data, callback) {
  data.queryPath = data.file;
  data.realPath = data.file;
  data.wrap = data.wrap !== undefined ? data.wrap : true;
  data = wraper.processScript(this, data);
  wraper.wrapScript(this, data, callback);
};

Cube.prototype.hook = function (hook, arg) {
  hook = this.config.hooks[hook];
  if (typeof hook === 'function') {
    return hook.call(this, arg);
  } else {
    return arg;
  }
}


module.exports = Cube;

