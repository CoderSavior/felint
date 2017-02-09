/* global Promise */

var fs = require('fs');
var path = require('path');
var YAML = require('js-yaml');

var DEFAULT_FELINTRC_CONFIG = {
    'eslintrc_es5': {
    },
    'eslintrc_es6': {
    },
    'scss-lint': {

    }
};

function has(pathStr) {
    if (pathStr) {
        try {
            var s = fs.statSync(pathStr);
        } catch (e) {
            return false;
        }
        return s;
    } else {
        return false;
    }
}

function treeHas(prePath, pathStr, targetFold) {
    if (prePath !== pathStr && pathStr && targetFold) {
        var fp = pathStr + '/' + targetFold;
        var s = has(fp);
        if (!s) {
            return treeHas(pathStr, path.dirname(pathStr), targetFold);
        } else {
            return {
                'stat': s,
                'path': fp,
                'dirname': pathStr
            };
        }
    } else {
        return false;
    }
}

function findUp(pathStr, target, type) {
    var result = treeHas('', pathStr, target);
    if (type && result) {
        if (!result.stat[type]()) {
            return findUp(path.dirname(result.path), target, type);
        }
    }
    return result;
}


function readJSON(pathStr) {
    var resFn;
    var rejFn;
    var p = new Promise(function(res, rej) {
        resFn = res;
        rejFn = rej;
    });
    if (!pathStr) {
        rejFn('path can not be empty');
    }
    var pathInfo = path.parse(pathStr);
    var fileContent;
    fs.access(pathStr, fs.F_OK | fs.R_OK, function(err) {
        if (err) {
            rejFn(pathInfo.base + ' file does not exist or can not be read, please check it');
        } else {
            try {
                fileContent = JSON.parse(fs.readFileSync(pathStr).toString());
            } catch (e) {
                console.log(e);
                rejFn('parse ' + pathInfo.base + ' error');
            }
            resFn(fileContent);
        }
    });
    return p;
}

function readYaml(pathStr) {
    var resFn;
    var rejFn;
    var p = new Promise(function(res, rej) {
        resFn = res;
        rejFn = rej;
    });
    if (!pathStr) {
        rejFn('path can not be empty');
    }
    var pathInfo = path.parse(pathStr);
    var fileContent;
    fs.access(pathStr, fs.F_OK | fs.R_OK, function(err) {
        if (err) {
            rejFn(pathInfo.base + ' file does not exist or can not be read, please check it');
        } else {
            try {
                fileContent = YAML.safeLoad(fs.readFileSync(pathStr, 'utf8'));
            } catch (e) {
                console.log(e);
                rejFn('parse ' + pathInfo.base + ' error');
            }
            resFn(fileContent);
        }
    });
    return p;
}

function createJSONFile(pathStr, content) {
    var resFn;
    var rejFn;
    var p = new Promise(function(res, rej) {
        resFn = res;
        rejFn = rej;
    });
    if (!pathStr || !content) {
        rejFn('neet pathStr and file content');
    } else {
        var contentStr = JSON.stringify(content || {}, null, 4);
        fs.writeFile(pathStr, contentStr, function(err) {
            if (err) {
                rejFn(err);
            } else {
                resFn();
            }
        });
    }
    return p;
}

function createJSONFileSync(pathStr, content) {
    if (!pathStr || !content) {
        console.log('neet pathStr and file content');
    } else {
        var contentStr = JSON.stringify(content || {}, null, 4);
        fs.writeFileSync(pathStr, contentStr);
    }
}

function createYAMLFile(pathStr, content) {
    var resFn;
    var rejFn;
    var p = new Promise(function(res, rej) {
        resFn = res;
        rejFn = rej;
    });
    if (!pathStr || !content) {
        rejFn('neet pathStr and file content');
    } else {
        var contentStr = YAML.safeDump(content || {});
        fs.writeFile(pathStr, contentStr, function(err) {
            if (err) {
                rejFn(err);
            } else {
                resFn();
            }
        });
    }
    return p;
}

function mergeEslintrcFile(esV) {
    var resFn;
    var rejFn;
    var p = new Promise(function(res, rej) {
        resFn = res;
        rejFn = rej;
    });
    // 找到.felint目录
    var gitHookPath = findUp(process.cwd(), '.felint', 'isDirectory');
    if (gitHookPath) {
        // 读取对应eslintrc文件
        readJSON(gitHookPath.path + '/.eslintrc_es' + esV).then(function(r) {
            var eslintrcContent = r;
            // 尝试读取 felintrc文件
            treeReadFile('.felintrc').then(function(c) {
                return Promise.resolve(c);
            }, function(r) {
                return Promise.resolve(DEFAULT_FELINTRC_CONFIG);
            }).then(function(c) {
                Object.assign(eslintrcContent.rules, c['eslintrc_es' + esV] || {});
                resFn(eslintrcContent);
            });
        }).catch(function(r) {
            rejFn(r);
        });
    } else {
        rejFn('can find .felint directory!');
    }
    return p;
}

function mergeScssLint() {
    var resFn;
    var rejFn;
    var p = new Promise(function(res, rej) {
        resFn = res;
        rejFn = rej;
    });
    // 找到.felint目录
    var gitHookPath = findUp(process.cwd(), '.felint', 'isDirectory');
    if (gitHookPath) {
        // 读取对应scss-lint文件
        readYaml(gitHookPath.path + '/.scss-lint.yml').then(function(r) {
            var yamlObj = r;
            // 尝试读取 felintrc文件
            treeReadFile('.felintrc').then(function(c) {
                return Promise.resolve(c);
            }, function(r) {
                return Promise.resolve(DEFAULT_FELINTRC_CONFIG);
            }).then(function(c) {
                Object.assign(yamlObj.linters, c['scss-lint'] || {});
                resFn(yamlObj);
            });
        }).catch(function(r) {
            rejFn(r);
        });
    } else {
        rejFn('can find .felint directory!');
    }
    return p;
}

function treeReadFile(filename) {
    // read file content
    var resFn;
    var rejFn;
    var p = new Promise(function(res, rej) {
        resFn = res;
        rejFn = rej;
    });
    var fileInfo = findUp(process.cwd(), filename, 'isFile');
    if (fileInfo) {
        readJSON(fileInfo.path).then(function(r) {
            resFn(r);
        }).catch(function(r) {
            rejFn(r);
        });
    } else {
        rejFn('can not find ' + filename + ' file');
    }
    return p;
}

module.exports = {
    mergeEslintrcFile: mergeEslintrcFile,
    readJSON: readJSON,
    treeReadFile: treeReadFile,
    createJSONFile: createJSONFile,
    findUp: findUp,
    mergeScssLint: mergeScssLint,
    createYAMLFile: createYAMLFile,
    has: has,
    createJSONFileSync: createJSONFileSync
}