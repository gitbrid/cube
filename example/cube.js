/*!
 * cube: example/cube.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 *
 * run in browser
 */
(function (HOST, rename) {

  var BASE = '';
  var CHARSET = 'utf-8';
  var VERSION = new Date().getTime();
  var TIMEOUT = 10000; // default 10's
  var DEBUG = false;
  var ENABLE_CSS = false;
  var ENABLE_SOURCE = window.localStorage ? window.localStorage.getItem('__cube_debug__') : false;

  /**
   * Class Cube
   *
   * 1. used as loaded module enter
   *   Cube(name, requires, callback);
   * 2. used as Cube constructor
   *   var loader = new Cube(name);
   *   loader.load(requires, callback);
   * @public
   * @param
   */
  function Cube (name, requires, callback) {
    if (arguments.length === 3) {
      var ld = new Cube(name);
      ld.load(requires, callback);
    } else {
      this.name = name ? name : '_';
      this.base = BASE;
      this.charset = CHARSET;
    }
  }
  /**
   * init global setting for Cube
   * @static
   * @param  {Object} config {base, charset, version, debug, timeout}
   * @return {Object} Cube
   */
  Cube.init = function (config) {
    if (config.base && config.base !== '/') {
      BASE = config.base.replace(/\/$/, '');
    }
    if (config.charset) {
      CHARSET = config.charset;
    }
    if (config.version) {
      VERSION = config.version;
    }
    if (config.debug) {
      DEBUG = config.debug;
    }
    if (config.timeout) {
      TIMEOUT = config.timeout;
    }
    if (config.enableCss) {
      ENABLE_CSS = config.enableCss;
    }
    return this;
  };
  /**
   * global switch for loading compressed-code, or source code
   * it's useful in pre env for debug, much better then sourcemap
   * @public
   */
  Cube.debug = function () {
    if (window.localStorage) {
      var item = localStorage.getItem('__cube_debug__');
      if (item) {
        localStorage.removeItem('__cube_debug__');
      } else {
        localStorage.setItem('__cube_debug__', true);
      }
    }
  };
  /**
   * loading module async, this function only support abs path
   * @public
   * @param  {Path}     mod module abs path
   * @param  {Function} cb  callback function, usually with module.exports as it's first param
   * @return {Object}   Cube
   */
  Cube.use = function (mod, cb) {
    if (!mod) {
      throw new Error('Cube.use(moduleName) moduleName is undefined!');
    }
    var ll = new Cube();
    ll.load(mod, function (module, exports, require) {
      cb(require(mod));
    });
    return this;
  };
  /**
   * @interface inject css into page
   * css inject is comp
   * ie8 and lower only support 32 stylesheets, so this function
   * @param  {String} name module name
   * @param  {CssCode} css  css code
   */
  Cube.css = function (mod, namespace) {};
  /**
   * remove module from mem cache
   * css remove should override this function to delete style node
   * @interface
   * @param  {Path}     name module name
   * @return {Object}   Cube
   */
  Cube.remove = function (name) {
    //
  };
  /**
   * register module in to cache
   * @param  {string} name    [description]
   * @param  {} exports [description]
   * @return {[type]}         [description]
   */
  Cube.register = function (name, exports) {
    var cached = this._cached[name];
    if (cached) {
      console.error('module already registered:', name);
    } else {
      this._cached[name] = exports;
    }
  };
  /**
   * module already loaded
   */
  Cube._cached = {};
  /**
   * module loaded broadcast
   */
  Cube._flag = {};
  Cube._tree = {};
  /**
   * global require function
   * @param  {[type]} mod [description]
   * @return {[type]}     [description]
   */
  function Require(mod, cb) {
    return Cube._cached[mod];
  }
  /**
   * async loading resource
   * i.e
   *   async(modName, function(mod){ //TODO// });
   *   async(cssMod, nameSpace, function(){ //TODO// });
   * @param {Path}   mod   [description]
   * @param {Function|String} cb    [description]
   * @param {Function}   param
   */
  function Async(mod, cb, param) {
    if (/\.css(\.js)?$/.test(mod)) {
      if (!ENABLE_CSS) {
        console.warn('[Cube] dynamic loading css disabled!');
        return;
      }
      // mod cb -> namespace
      Cube.use(mod, function (css) {
        if (typeof cb === 'function') {
          cb(css);
        } else {
          Cube.css(css, cb, mod);
          param && param();
        }
      });
    } else {
      Cube.use(mod, cb);
    }
  }
  /**
   get module by name
   **/
  Cube.module = function (name) {
    return this._cached[name];
  };
  Cube.prototype = {
    /**
     * load script from server
     * @param {string|array} require
     * @param {function} cb callback
     */
    load: function (req, cb) {
      var mName = this.name;
      var require = req;
      if (typeof require === 'string') {
        // setup file timeout
        setTimeout(function () {
          if (Cube._flag[req]) {
            console.error('load script timeout:', req);
          }
        }, TIMEOUT);
      }

      if (!require) {
        require = [];
      } else if (typeof require === 'string') {
        require = [require];
      }
      //if(!cb) cb = function(){};
      var len = require.length;
      var _stack = [];
      var ifCycle = false;
      this._load_stack = {
        req: _stack,
        total: len,
        cb: cb,
        count: 0
      };
      if (len) {
        for (var i = 0, tmp; i < len ; i++) {
          tmp = require[i];
          if (DEBUG) {
            if (!Cube._tree[tmp]) {
              Cube._tree[tmp] = {};
            }
            Cube._tree[tmp][mName] = true;
            ifCycle = this._checkCycle(tmp);
          }
          if (!ifCycle) {
            _stack.push(tmp);
            this._loadScript(tmp);
          }
        }
        if (!_stack.length) {
          this._leafMod(cb);
        }
      } else {
        this._leafMod(cb);
      }
    },
    /**
     * [_loaded description]
     * @return {[type]} [description]
     */
    _leafMod: function (cb) {
      var mod;
      var module = {exports : {}};
      if (cb) {
        mod = cb.apply(HOST, [module, module.exports, Require, Async, '', '']);
      }
      if (!mod) {
        mod = true;
      } else {
        mod.__filename = this.name;
      }
      Cube._cached[this.name] = mod;
      fireMod(this.name);
    },
    _checkCycle: function (name, parents) {
      if (!parents) {
        parents = [name];
      }
      var tmp = Cube._tree[name];
      var tmpParent;
      var flag;
      if (!tmp) {
        return false;
      }
      for (var i in tmp) {
        if (parents.indexOf(i) !== -1) {
          parents.unshift(i);
          console.warn('[WARNNING]', 'cycle require : ' + parents.join(' > '));
          return true;
        }
        tmpParent = parents.slice(0);
        tmpParent.unshift(i);
        flag = this._checkCycle(i, tmpParent);
        if (flag) {
          return true;
        }
      }
      return false;
    },
    _loadScript: function (name, bool) {
      var mod = Cube._cached[name];
      var self = this;
      var ww = Cube._flag;
      function cb(mm) {
        var flag = self._load_stack;
        var ok = false;
        if (Cube._cached[mm]) {
          flag.count ++;
          ok = self.name;
        }
        // check if all require is done;
        if (flag.total <= flag.count) {
          var module = {exports : {}};
          var s_filename = self.name;
          var s_dirname = s_filename.replace(/[^\/]*$/, '');
          var mod;
          if (flag.cb) {
            mod = flag.cb.apply(HOST, [module, module.exports, Require, Async, s_filename, s_dirname]);
          }
          if (!mod) {
            mod = true;
          } else {
            mod.__filename = self.name;
          }
          Cube._cached[self.name] = mod;
        }
        return ok;
      }

      if (mod) {
        ww = cb(name);
        if (ww !== false) {
          fireMod(ww);
        }
        return;
      } else if (mod === false) {
        ww[name].push(cb);
        return;
      }

      if (!ww[name]) {
        ww[name] = [];
      }
      ww[name].push(cb);
      Cube._cached[name] = false;
      var script = document.getElementsByTagName('head')[0].appendChild(document.createElement('script'));
      script.type = 'text/javascript';
      script.async = 'true';
      script.charset = this.charset;
      if (ENABLE_SOURCE && !/\.css\.js$/.test(name)) {
        name = name.replace(/\.js$/, '.source.js');
      }
      var _src = [ this.base, name, '?m=1&', VERSION];
      script.src = _src.join('');
    }
  };
  /**
   * fire a module loaded event
   * @param  {String} name modulename
   */
  function fireMod(name) {
    var wts = Cube._flag, ww, flag, res = {};
    ww = wts[name];
    if (ww) {
      for (var n = ww.length - 1; n >= 0; n --) {
        flag = ww[n](name);
        if (flag !== false) { // module relative ok
          ww.splice(n, 1);
          n = ww.length;
          if (flag) {
            res[flag] = true;
          }
        }
      }
      if (!ww.length) {
        delete  wts[name];
      }
      for (n in res) {
        // one module self is loaded ,so fire it
        fireMod(n);
      }
    }
  }

  rename = rename ? rename : 'Cube';
  if (HOST[rename]) {
    console.log('window.' + rename + ' already in using, replace the last "null" param in cube.js');
  } else {
    HOST[rename] = Cube;
  }

})(window, null);

!(function () {

if (!Cube) {
  return;
}

Cube.css = function (css, namespace, file) {
  var ast, newCss;
  if (!css.trim()) {
    return;
  }
  if (namespace) {
    ast.stylesheet.rules.forEach(function (v) {
      if (!v.selectors) {
        return;
      }
      var selectors = v.selectors;
      selectors.forEach(function (s, i, a) {
        a[i] = namespace + ' ' + s;
      });
    });
    try {
      ast = parse(css, {source: file});
    } catch (e) {
      e.message = '[Cube CSS] ' + e.message + ' ' + e.filename;
      throw e;
    }
    newCss = stringify(ast);
  } else {
    newCss = css;
  }
  var headNode = document.getElementsByTagName('HEAD')[0];
  var style = document.createElement('style');
  style.setAttribute('type', 'text/css');
  style.setAttribute('mod', file);
  headNode.appendChild(style);
  style.innerHTML = newCss;
};
/**
 *  the following code from npm module: css
 *  git@github.com:reworkcss/css.git
 *  License MIT
 *  @author TJ Holowaychuk <tj@vision-media.ca>
 *
 */

/**
 * ==============================
 * Parser
 * ==============================
 */
var commentre = /\/\*[^*]*\*+([^/*][^*]*\*+)*\//g;

function parse(css, options) {
  options = options || {};

  /**
   * Positional.
   */

  var lineno = 1;
  var column = 1;

  /**
   * Update lineno and column based on `str`.
   */

  function updatePosition(str) {
    var lines = str.match(/\n/g);
    if (lines) {
      lineno += lines.length;
    }
    var i = str.lastIndexOf('\n');
    column = ~i ? str.length - i : column + str.length;
  }

  /**
   * Mark position and patch `node.position`.
   */

  function position() {
    var start = { line: lineno, column: column };
    return function(node){
      node.position = new Position(start);
      whitespace();
      return node;
    };
  }

  /**
   * Store position information for a node
   */

  function Position(start) {
    this.start = start;
    this.end = { line: lineno, column: column };
    this.source = options.source;
  }

  /**
   * Non-enumerable source string
   */

  Position.prototype.content = css;

  /**
   * Error `msg`.
   */

  function error(msg) {
    if (options.silent === true) {
      return false;
    }

    var err = new Error(msg + ' near line ' + lineno + ':' + column);
    err.filename = options.source;
    err.line = lineno;
    err.column = column;
    err.source = css;
    throw err;
  }

  /**
   * Parse stylesheet.
   */

  function stylesheet() {
    return {
      type: 'stylesheet',
      stylesheet: {
        rules: rules()
      }
    };
  }

  /**
   * Opening brace.
   */

  function open() {
    return match(/^{\s*/);
  }

  /**
   * Closing brace.
   */

  function close() {
    return match(/^}/);
  }

  /**
   * Parse ruleset.
   */

  function rules() {
    var node;
    var rules = [];
    whitespace();
    comments(rules);
    while (css.length && css.charAt(0) != '}' && (node = atrule() || rule())) {
      if (node !== false) {
        rules.push(node);
        comments(rules);
      }
    }
    return rules;
  }

  /**
   * Match `re` and return captures.
   */

  function match(re) {
    var m = re.exec(css);
    if (!m) return;
    var str = m[0];
    updatePosition(str);
    css = css.slice(str.length);
    return m;
  }

  /**
   * Parse whitespace.
   */

  function whitespace() {
    match(/^\s*/);
  }

  /**
   * Parse comments;
   */

  function comments(rules) {
    var c;
    rules = rules || [];
    while (c = comment()) {
      if (c !== false) {
        rules.push(c);
      }
    }
    return rules;
  }

  /**
   * Parse comment.
   */

  function comment() {
    var pos = position();
    if ('/' != css.charAt(0) || '*' != css.charAt(1)) return;

    var i = 2;
    while ("" != css.charAt(i) && ('*' != css.charAt(i) || '/' != css.charAt(i + 1))) ++i;
    i += 2;

    if ("" === css.charAt(i-1)) {
      return error('End of comment missing');
    }

    var str = css.slice(2, i - 2);
    column += 2;
    updatePosition(str);
    css = css.slice(i);
    column += 2;

    return pos({
      type: 'comment',
      comment: str
    });
  }

  /**
   * Parse selector.
   */

  function selector() {
    var m = match(/^([^{]+)/);
    if (!m) return;
    /* @fix Remove all comments from selectors
     * http://ostermiller.org/findcomment.html */
    return trim(m[0])
      .replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*\/+/g, '')
      .replace(/(?:"[^"]*"|'[^']*')/g, function(m) {
        return m.replace(/,/g, '\u200C');
      })
      .split(/\s*(?![^(]*\)),\s*/)
      .map(function(s) {
        return s.replace(/\u200C/g, ',');
      });
  }

  /**
   * Parse declaration.
   */

  function declaration() {
    var pos = position();

    // prop
    var prop = match(/^(\*?[-#\/\*\\\w]+(\[[0-9a-z_-]+\])?)\s*/);
    if (!prop) return;
    prop = trim(prop[0]);

    // :
    if (!match(/^:\s*/)) return error("property missing ':'");

    // val
    var val = match(/^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^\)]*?\)|[^};])+)/);

    var ret = pos({
      type: 'declaration',
      property: prop.replace(commentre, ''),
      value: val ? trim(val[0]).replace(commentre, '') : ''
    });

    // ;
    match(/^[;\s]*/);

    return ret;
  }

  /**
   * Parse declarations.
   */

  function declarations() {
    var decls = [];

    if (!open()) return error("missing '{'");
    comments(decls);

    // declarations
    var decl;
    while (decl = declaration()) {
      if (decl !== false) {
        decls.push(decl);
        comments(decls);
      }
    }

    if (!close()) return error("missing '}'");
    return decls;
  }

  /**
   * Parse keyframe.
   */

  function keyframe() {
    var m;
    var vals = [];
    var pos = position();

    while (m = match(/^((\d+\.\d+|\.\d+|\d+)%?|[a-z]+)\s*/)) {
      vals.push(m[1]);
      match(/^,\s*/);
    }

    if (!vals.length) return;

    return pos({
      type: 'keyframe',
      values: vals,
      declarations: declarations()
    });
  }

  /**
   * Parse keyframes.
   */

  function atkeyframes() {
    var pos = position();
    var m = match(/^@([-\w]+)?keyframes */);

    if (!m) return;
    var vendor = m[1];

    // identifier
    var m = match(/^([-\w]+)\s*/);
    if (!m) return error("@keyframes missing name");
    var name = m[1];

    if (!open()) return error("@keyframes missing '{'");

    var frame;
    var frames = comments();
    while (frame = keyframe()) {
      frames.push(frame);
      frames = frames.concat(comments());
    }

    if (!close()) return error("@keyframes missing '}'");

    return pos({
      type: 'keyframes',
      name: name,
      vendor: vendor,
      keyframes: frames
    });
  }

  /**
   * Parse supports.
   */

  function atsupports() {
    var pos = position();
    var m = match(/^@supports *([^{]+)/);

    if (!m) return;
    var supports = trim(m[1]);

    if (!open()) return error("@supports missing '{'");

    var style = comments().concat(rules());

    if (!close()) return error("@supports missing '}'");

    return pos({
      type: 'supports',
      supports: supports,
      rules: style
    });
  }

  /**
   * Parse host.
   */

  function athost() {
    var pos = position();
    var m = match(/^@host */);

    if (!m) return;

    if (!open()) return error("@host missing '{'");

    var style = comments().concat(rules());

    if (!close()) return error("@host missing '}'");

    return pos({
      type: 'host',
      rules: style
    });
  }

  /**
   * Parse media.
   */

  function atmedia() {
    var pos = position();
    var m = match(/^@media *([^{]+)/);

    if (!m) return;
    var media = trim(m[1]);

    if (!open()) return error("@media missing '{'");

    var style = comments().concat(rules());

    if (!close()) return error("@media missing '}'");

    return pos({
      type: 'media',
      media: media,
      rules: style
    });
  }


  /**
   * Parse custom-media.
   */

  function atcustommedia() {
    var pos = position();
    var m = match(/^@custom-media (--[^\s]+) *([^{;]+);/);
    if (!m) return;

    return pos({
      type: 'custom-media',
      name: trim(m[1]),
      media: trim(m[2])
    });
  }

  /**
   * Parse paged media.
   */

  function atpage() {
    var pos = position();
    var m = match(/^@page */);
    if (!m) return;

    var sel = selector() || [];

    if (!open()) return error("@page missing '{'");
    var decls = comments();

    // declarations
    var decl;
    while (decl = declaration()) {
      decls.push(decl);
      decls = decls.concat(comments());
    }

    if (!close()) return error("@page missing '}'");

    return pos({
      type: 'page',
      selectors: sel,
      declarations: decls
    });
  }

  /**
   * Parse document.
   */

  function atdocument() {
    var pos = position();
    var m = match(/^@([-\w]+)?document *([^{]+)/);
    if (!m) return;

    var vendor = trim(m[1]);
    var doc = trim(m[2]);

    if (!open()) return error("@document missing '{'");

    var style = comments().concat(rules());

    if (!close()) return error("@document missing '}'");

    return pos({
      type: 'document',
      document: doc,
      vendor: vendor,
      rules: style
    });
  }

  /**
   * Parse font-face.
   */

  function atfontface() {
    var pos = position();
    var m = match(/^@font-face */);
    if (!m) return;

    if (!open()) return error("@font-face missing '{'");
    var decls = comments();

    // declarations
    var decl;
    while (decl = declaration()) {
      decls.push(decl);
      decls = decls.concat(comments());
    }

    if (!close()) return error("@font-face missing '}'");

    return pos({
      type: 'font-face',
      declarations: decls
    });
  }

  /**
   * Parse import
   */

  var atimport = _compileAtrule('import');

  /**
   * Parse charset
   */

  var atcharset = _compileAtrule('charset');

  /**
   * Parse namespace
   */

  var atnamespace = _compileAtrule('namespace');

  /**
   * Parse non-block at-rules
   */


  function _compileAtrule(name) {
    var re = new RegExp('^@' + name + ' *([^;\\n]+);');
    return function() {
      var pos = position();
      var m = match(re);
      if (!m) return;
      var ret = { type: name };
      ret[name] = m[1].trim();
      return pos(ret);
    }
  }

  /**
   * Parse at rule.
   */

  function atrule() {
    if (css[0] != '@') return;

    return atkeyframes()
      || atmedia()
      || atcustommedia()
      || atsupports()
      || atimport()
      || atcharset()
      || atnamespace()
      || atdocument()
      || atpage()
      || athost()
      || atfontface();
  }

  /**
   * Parse rule.
   */

  function rule() {
    var pos = position();
    var sel = selector();

    if (!sel) return error('selector missing');
    comments();

    return pos({
      type: 'rule',
      selectors: sel,
      declarations: declarations()
    });
  }

  return addParent(stylesheet());
}

/**
 * Trim `str`.
 */

function trim(str) {
  return str ? (str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '')) : '';
}

/**
 * Adds non-enumerable parent node reference to each node.
 */

function addParent(obj, parent) {
  var isNode = obj && typeof obj.type === 'string';
  var childParent = isNode ? obj : parent;

  for (var k in obj) {
    var value = obj[k];
    if (Array.isArray(value)) {
      value.forEach(function(v) { addParent(v, childParent); });
    } else if (value && typeof value === 'object') {
      addParent(value, childParent);
    }
  }

  if (isNode) {
    Object.defineProperty(obj, 'parent', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: parent || null
    });
  }

  return obj;
}

/**
 * ===============================
 * Initialize a compiler.
 * ===============================
 * @param {Object} opts
 * @api public
 */

function stringify(ast, options) {
  var compiler = new Compiler(options);
  return compiler.compile(ast);
}

function Compiler(opts) {
  this.options = opts || {};
  this.indentation = this.options.indent;
}

/**
 * Emit `str`
 */

Compiler.prototype.emit = function (str) {
  return str;
};

/**
 * Visit `node`.
 */

Compiler.prototype.visit = function (node) {
  return this[node.type](node);
};

/**
 * Map visit over array of `nodes`, optionally using a `delim`
 */

Compiler.prototype.mapVisit = function (nodes, delim) {
  var buf = '';
  delim = delim || '';

  for (var i = 0, length = nodes.length; i < length; i++) {
    buf += this.visit(nodes[i]);
    if (delim && i < length - 1) {
      buf += this.emit(delim);
    }
  }

  return buf;
};
/**
 * Compile `node`.
 */

Compiler.prototype.compile = function(node){
  return this.stylesheet(node);
};

/**
 * Visit stylesheet node.
 */

Compiler.prototype.stylesheet = function(node){
  return this.mapVisit(node.stylesheet.rules, '\n\n');
};

/**
 * Visit comment node.
 */

Compiler.prototype.comment = function(node){
  return this.emit(this.indent() + '/*' + node.comment + '*/', node.position);
};

/**
 * Visit import node.
 */

Compiler.prototype.import = function(node){
  return this.emit('@import ' + node.import + ';', node.position);
};

/**
 * Visit media node.
 */

Compiler.prototype.media = function(node){
  return this.emit('@media ' + node.media, node.position)
    + this.emit(
        ' {\n'
        + this.indent(1))
    + this.mapVisit(node.rules, '\n\n')
    + this.emit(
        this.indent(-1)
        + '\n}');
};

/**
 * Visit document node.
 */

Compiler.prototype.document = function(node){
  var doc = '@' + (node.vendor || '') + 'document ' + node.document;

  return this.emit(doc, node.position)
    + this.emit(
        ' '
      + ' {\n'
      + this.indent(1))
    + this.mapVisit(node.rules, '\n\n')
    + this.emit(
        this.indent(-1)
        + '\n}');
};

/**
 * Visit charset node.
 */

Compiler.prototype.charset = function(node){
  return this.emit('@charset ' + node.charset + ';', node.position);
};

/**
 * Visit namespace node.
 */

Compiler.prototype.namespace = function(node){
  return this.emit('@namespace ' + node.namespace + ';', node.position);
};

/**
 * Visit supports node.
 */

Compiler.prototype.supports = function(node){
  return this.emit('@supports ' + node.supports, node.position)
    + this.emit(
      ' {\n'
      + this.indent(1))
    + this.mapVisit(node.rules, '\n\n')
    + this.emit(
        this.indent(-1)
        + '\n}');
};

/**
 * Visit keyframes node.
 */

Compiler.prototype.keyframes = function(node){
  return this.emit('@' + (node.vendor || '') + 'keyframes ' + node.name, node.position)
    + this.emit(
      ' {\n'
      + this.indent(1))
    + this.mapVisit(node.keyframes, '\n')
    + this.emit(
        this.indent(-1)
        + '}');
};

/**
 * Visit keyframe node.
 */

Compiler.prototype.keyframe = function(node){
  var decls = node.declarations;

  return this.emit(this.indent())
    + this.emit(node.values.join(', '), node.position)
    + this.emit(
      ' {\n'
      + this.indent(1))
    + this.mapVisit(decls, '\n')
    + this.emit(
      this.indent(-1)
      + '\n'
      + this.indent() + '}\n');
};

/**
 * Visit page node.
 */

Compiler.prototype.page = function(node){
  var sel = node.selectors.length
    ? node.selectors.join(', ') + ' '
    : '';

  return this.emit('@page ' + sel, node.position)
    + this.emit('{\n')
    + this.emit(this.indent(1))
    + this.mapVisit(node.declarations, '\n')
    + this.emit(this.indent(-1))
    + this.emit('\n}');
};

/**
 * Visit font-face node.
 */

Compiler.prototype['font-face'] = function(node){
  return this.emit('@font-face ', node.position)
    + this.emit('{\n')
    + this.emit(this.indent(1))
    + this.mapVisit(node.declarations, '\n')
    + this.emit(this.indent(-1))
    + this.emit('\n}');
};

/**
 * Visit host node.
 */

Compiler.prototype.host = function(node){
  return this.emit('@host', node.position)
    + this.emit(
        ' {\n'
        + this.indent(1))
    + this.mapVisit(node.rules, '\n\n')
    + this.emit(
        this.indent(-1)
        + '\n}');
};

/**
 * Visit custom-media node.
 */

Compiler.prototype['custom-media'] = function(node){
  return this.emit('@custom-media ' + node.name + ' ' + node.media + ';', node.position);
};

/**
 * Visit rule node.
 */

Compiler.prototype.rule = function(node){
  var indent = this.indent();
  var decls = node.declarations;
  if (!decls.length) {
    return '';
  }

  return this.emit(node.selectors.map(function(s){ return indent + s }).join(',\n'), node.position)
    + this.emit(' {\n')
    + this.emit(this.indent(1))
    + this.mapVisit(decls, '\n')
    + this.emit(this.indent(-1))
    + this.emit('\n' + this.indent() + '}');
};

/**
 * Visit declaration node.
 */

Compiler.prototype.declaration = function(node){
  return this.emit(this.indent())
    + this.emit(node.property + ': ' + node.value, node.position)
    + this.emit(';');
};

/**
 * Increase, decrease or return current indentation.
 */

Compiler.prototype.indent = function(level) {
  this.level = this.level || 1;

  if (null != level) {
    this.level += level;
    return '';
  }

  return Array(this.level).join(this.indentation || '  ');
};

})();

Cube.register("jade_runtime",function(){var r={};function e(r,t){if(arguments.length===1){var a=r[0];for(var i=1;i<r.length;i++){a=e(a,r[i])}return a}var s=r["class"];var f=t["class"];if(s||f){s=s||[];f=f||[];if(!Array.isArray(s))s=[s];if(!Array.isArray(f))f=[f];r["class"]=s.concat(f).filter(n)}for(var l in t){if(l!="class"){r[l]=t[l]}}return r}r.merge=e;function n(r){return r!=null&&r!==""}r.joinClasses=t;function t(r){return Array.isArray(r)?r.map(t).filter(n).join(" "):r}function a(e,n){var a=[];for(var i=0;i<e.length;i++){if(n&&n[i]){a.push(r.escape(t([e[i]])))}else{a.push(t(e[i]))}}var s=t(a);if(s.length){return' class="'+s+'"'}else{return""}}r.cls=a;function i(e,n,t,a){if("boolean"==typeof n||null==n){if(n){return" "+(a?e:e+'="'+e+'"')}else{return""}}else if(0==e.indexOf("data")&&"string"!=typeof n){return" "+e+"='"+JSON.stringify(n).replace(/'/g,"&apos;")+"'"}else if(t){return" "+e+'="'+r.escape(n)+'"'}else{return" "+e+'="'+n+'"'}}r.attr=i;function s(e,n){var a=[];var i=Object.keys(e);if(i.length){for(var s=0;s<i.length;++s){var f=i[s],l=e[f];if("class"==f){if(l=t(l)){a.push(" "+f+'="'+l+'"')}}else{a.push(r.attr(f,l,false,n))}}}return a.join("")}r.attrs=s;function f(r){var e=String(r).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");if(e===""+r)return r;else return e}r.escape=f;function l(r,e,n,t){if(!(r instanceof Error))throw r;if((typeof window!="undefined"||!e)&&!t){r.message+=" on line "+n;throw r}try{t=t||_dereq_("fs").readFileSync(e,"utf8")}catch(a){l(r,null,n)}var i=3,s=t.split("\n"),f=Math.max(n-i,0),u=Math.min(s.length,n+i);var i=s.slice(f,u).map(function(r,e){var t=e+f+1;return(t==n?"  > ":"    ")+t+"| "+r}).join("\n");r.path=e;r.message=(e||"Jade")+":"+n+"\n"+i+"\n\n"+r.message;throw r}r.rethrow=l;return r}());
Cube.register("ejs_runtime",function(){var r={};r.first=function(r){return r[0]};r.last=function(r){return r[r.length-1]};r.capitalize=function(r){r=String(r);return r[0].toUpperCase()+r.substr(1,r.length)};r.downcase=function(r){return String(r).toLowerCase()};r.upcase=function(r){return String(r).toUpperCase()};r.sort=function(r){return Object.create(r).sort()};r.sort_by=function(r,n){return Object.create(r).sort(function(r,t){r=r[n],t=t[n];if(r>t)return 1;if(r<t)return-1;return 0})};r.size=r.length=function(r){return r.length};r.plus=function(r,n){return Number(r)+Number(n)};r.minus=function(r,n){return Number(r)-Number(n)};r.times=function(r,n){return Number(r)*Number(n)};r.divided_by=function(r,n){return Number(r)/Number(n)};r.join=function(r,n){return r.join(n||", ")};r.truncate=function(r,n,t){r=String(r);if(r.length>n){r=r.slice(0,n);if(t)r+=t}return r};r.truncate_words=function(r,n){var r=String(r),t=r.split(/ +/);return t.slice(0,n).join(" ")};r.replace=function(r,n,t){return String(r).replace(n,t||"")};r.prepend=function(r,n){return Array.isArray(r)?[n].concat(r):n+r};r.append=function(r,n){return Array.isArray(r)?r.concat(n):r+n};r.map=function(r,n){return r.map(function(r){return r[n]})};r.reverse=function(r){return Array.isArray(r)?r.reverse():String(r).split("").reverse().join("")};r.get=function(r,n){return r[n]};r.json=function(r){return JSON.stringify(r)};return r}());