/*jslint
    node: true,
    nomen: true,
    undef: true,
    unparam: true,
    stupid: true,
    evil: true,
    white: true
*/

var _,
    fs,
    cp,
    request,
    midi,
    readline,
    beautify,
    PROCESS_MODE,
    RENDER_MODE,
    REMOTE_URL,
    VERSION;

_ = require('lodash');
fs = require('fs');
cp = require('child_process');
request = require('request');
midi = require('./midi');
readline = require('readline');
beautify = require('node-beautify');

PROCESS_MODE = 'file';
RENDER_MODE = 'local';
REMOTE_URL = 'http://takayukihamano.net:3000';
VERSION = '0.9.0';

(function () {
    
    'use strict';
    
    var rlInterface,
        file,
        options,
        stacks,
        currentStack,
        global,
        methods,
        funcs,
        storedData,
        variables,
        jsVariables,
        completions,
        state,
        code,
        standByREPL,
        quitting;
    
    options = {};
    global = {
        cmdHistory: []
    };
    methods = {};
    funcs = {};
    storedData = [];
    variables = {};
    jsVariables = {};
    completions = [];
    state = {
        channel: 0,
        track: 0,
        currentFuncs: []
    };
    quitting = false;
    global.methods = methods;
    
    process.on('exit', function () {
        if (PROCESS_MODE === 'repl') {
            console.log();
        }
    });
    
    function clear() {
        stacks = [];
        currentStack = null;
    }
    
    function getDir(path) {
        path = path.split('/');
        path.pop();
        return path.join('/');
    }
    
    function getOptions() {
        // console.log(process.argv);
        _.each(process.argv.splice(2), function (v) {
            var opt;
            if (v.indexOf('--') === 0) {
                opt = v.substring(2).split('=');
                options[opt[0].toLowerCase()] = (opt[1] !== undefined) ? opt[1] : true;
            } else if (v === '-v') {
                console.log(VERSION);
                process.exit(0);
            } else {
                file = v;
            }
        });
        if (file === undefined) {
            PROCESS_MODE = 'repl';
        }
        if (options.dir !== undefined) {
            file = [options.dir, file].join('/');
            options.dir = getDir(file);
        }
        global.dir = options.dir;
        if (options.local) {
            RENDER_MODE = 'local';
        } else if (options.remote) {
            RENDER_MODE = 'remote';
        }
    }
    
    function loadLibraries() {
        var files;
        files = fs.readdirSync('lib');
        _.each(files, function (f) {
            methods = _.merge(methods, require('./lib/' + f));
        });
        _.each(methods, function (v, k) {
            completions.push(k);
        });
        completions.push('include');
    }
    
    function readFile(path, callback) {
        var data;
        try {
            data = _.compact(fs.readFileSync(path).toString().split('\n'));
        } catch (e) {
            console.log('could not load file: ' + path);
            data = [];
        }
        if (typeof callback === 'function') {
            callback(data);
        }
        return data;
    }
    
    function preprocess(data, callback) {
        var includeFound;
        includeFound = true;
        function setDir(data, dir) {
            _.each(data, function (d, i) {
                d = d.split(' ');
                if (d[0] === 'include') {
                    data[i] = [data[i], dir].join(' ');
                }
            });
            return data;
        }
        data = setDir(data, getDir(file));
        while (includeFound) {
            includeFound = false;
            _.each(data, function (d, i) {
                var newData, path;
                if (includeFound) {
                    return;
                }
                d = d.split(' ');
                if (d[0] === 'include') {
                    path = [d[2], d[1]].join('/');
                    newData = readFile(path);
                    newData = setDir(newData, getDir(path));
                    data.splice(i, 1, newData);
                    data = _.flatten(data);
                    includeFound = true;
                }
            });
        }
        callback(data);
    }
    
    function splitParts(str) {
        var stack, a, b, s, isExp, exp;
        stack = [];
        a = [];
        s = null;
        exp = null;
        str += ' ';
        isExp = 0;
        _.each(str, function (c) {
            if (c.match(/\s/)) {
                if (isExp > 0) {
                    exp += c;
                } else {
                    if (s !== null) {
                        a.push(s);
                    }
                    s = null;
                }
            } else if (c === '[') {
                if (isExp > 0) {
                    exp += '[';
                } else {
                    stack.push(a);
                    a = [];
                    s = null;
                }
            } else if (c === ']') {
                if (isExp > 0) {
                    exp += ']';
                } else {
                    if (s !== null) {
                        a.push(s);
                    }
                    s = null;
                    b = stack.pop();
                    b.push(a);
                    a = b;
                }
            } else if (c === '(') {
                isExp += 1;
                if (exp === null) {
                    exp = '';
                }
                exp += '(';
            } else if (c === ')') {
                isExp -= 1;
                exp += ')';
                if (isExp === 0) {
                    s = exp;
                    exp = null;
                }
            } else {
                if (isExp > 0) {
                    exp += c;
                } else {
                    if (s === null) {
                        s = '';
                    }
                    s += c;
                }
            }
        });
        return a;
    }
    
    function parseValue(v, type) {
        if (_.first(v) === '(' && _.last(v) === ')') {
            try {
                v = eval(v);
            } catch (e) {
                return undefined;
            }
        }
        if (v[0] === '$') {
            return v;
        }
        switch (type) {
        case 'integer':
            v = parseInt(v, 10);
            break;
        case 'float':
            v = parseFloat(v);
            break;
        case 'string':
            v = v.toString();
            break;
        case 'array':
            break;
        }
        return v;
    }
    
    function parseArgsAndParams(task) {
        var m;
        m = methods[task.cmd];
        // console.log(task);
        if (m !== undefined) {
            _.each(task.args, function (v, i) {
                var type, tmp;
                type = (m.args[i] !== undefined) ? m.args[i].type : undefined;
                tmp = parseValue(v, type);
                if (tmp !== undefined) {
                    task.args[i] = tmp;
                }
            });
        }
        _.each(task.params, function (v, k) {
            var type, tmp;
            type = _.find(m.args, function (v) {
                return v.label === k;
            }).type;
            tmp = parseValue(v, type);
            if (tmp !== undefined) {
                task.params[k] = tmp;
            }
        });
    }
    
    function parse(data, callback) {
        // console.log('@parse');
        // console.log(data);
        var currentTask, failed, newStacks, isCode;
        currentTask = null;
        failed = false;
        isCode = false;
        _.each(data, function (s) {
            var indented, cmd, nTimes;
            if (s.indexOf('#') >= 0) {
                s = s.substring(0, s.indexOf('#'));
            }
            if (s[0] === '{') {
                isCode = true;
                code = '';
                return;
            } else if (s[0] === '}') {
                isCode = false;
                cmd = 'code';
                s = [code];
                console.log(s);
            } else if (s[0] === '(') {
                cmd = 'push';
                s = [];
            } else if (s[0] === ')') {
                cmd = 'pop';
                s = [];
            } else if (isCode) {
                code += s + '\n';
                return;
            } else {
                indented = (s.match(/^\s/) !== null);
                s = s.replace(/^\s+/, '');
                s = splitParts(s);
                cmd = s.shift();
            }
            if (cmd === undefined || cmd === '') {
                return;
            }
            if (cmd !== 'history') {
                global.cmdHistory.push(cmd + ' ' + s.join(' '));
            }
            if (cmd[0] === '*') {
                nTimes = parseInt(cmd.substring(1), 10);
                cmd = s.shift();
            }
            if (currentStack === null || cmd === '---') {
                currentStack = [];
                stacks.push(currentStack);
                currentTask = null;
            }
            if (cmd === '---' && PROCESS_MODE === 'repl') {
                storedData = [];
            }
            if (PROCESS_MODE === 'file') {
                console.log('> ' + (indented ? '...' : '') + cmd + ' ' + s.join(' '));
            }
            if (indented) {
                if (currentTask !== null) {
                    currentTask.params[cmd] = (_.size(s) === 1) ? s[0] : s;
                }
            } else if (cmd !== '---') {
                currentTask = {
                    cmd: cmd,
                    params: {}
                };
                
                if (currentTask.cmd === 'code') {
                    currentTask.params = {code: code};
                } else if (methods[cmd] !== undefined && methods[cmd].args !== undefined) {
                    _.each(methods[cmd].args, function (a, i) {
                        var v;
                        v = (s[i] !== undefined) ? s[i] : a.defaultValue;
                        if (v === undefined) {
                            console.error('ERROR: missing argument <' + a.label + '> for \"' + cmd + '\"');
                            failed = true;
                        } else {
                            currentTask.params[a.label] = v;
                        }
                    });
                }
                currentTask.args = _.cloneDeep(s);
                if (nTimes > 0) {
                    currentTask.nTimes = nTimes;
                }
                currentStack.push(currentTask);
            }
            
        });
        
        // console.log(stacks);
        // console.log(data);
        
        newStacks = [];
        _.each(stacks, function (stack) {
            var newStack = [];
            _.each(stack, function (s) {
                if (s.nTimes > 0) {
                    _.times(s.nTimes, function (index) {
                        var newS;
                        newS = _.cloneDeep(s);
                        _.each(newS.params, function (v, k) {
                            if (typeof v === 'string') {
                                newS.params[k] = replaceAll(v, '$i', index.toString());
                            }
                        });
                        _.each(newS.args, function (v, i) {
                            if (typeof v === 'string') {
                                newS.args[i] = replaceAll(v, '$i', index.toString());
                            }
                        });
                        newStack.push(newS);
                    });
                } else {
                    newStack.push(s);
                }
            });
            newStacks.push(newStack);
        });
        
        stacks = newStacks;
        
        if (failed && PROCESS_MODE === 'file') {
            console.error('parse failed.');
            process.exit(-1);
        }
        
        // console.log(stacks);
        
        callback(stacks);
    }
    
    global.createFunc = function (label, args) {
        // console.log(args);
        if (funcs[label] === undefined) {
            funcs[label] = {
                args: args,
                tasks: []
            };
        }
        completions.push(label);
    };
    
    global.stack = [];
    
    function escapeRegExp(str) {
        return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }
    
    function replaceAll(str, find, replace) {
        return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
    }
    
    function compile(stacks, callback) {
        var result;
        result = {};
        _.each(stacks, function (stack) {
            var data;
            data = (PROCESS_MODE === 'repl') ? storedData : [];
            // console.log('---');
            _.each(stack, function (task) {
                // console.log('!!! task');
                // console.log(task);
                _.each(state.currentFuncs, function (f) {
                    if (task.cmd !== '>>>' && task.cmd !== '<<<') {
                        funcs[f].tasks.push(task);
                    }
                });
                
                function applyVariables(task, variables) {
                    if (variables.hasOwnProperty('$i')) {
                        variables.$i = parseInt(variables.$i, 10);
                    }
                    _.each(task.args, function (a, i) {
                        _.each(variables, function (v, label) {
                            if (typeof task.args[i] === 'string' && label[0] === '$') {
                                task.args[i] = replaceAll(task.args[i], label, JSON.stringify(v));
                            }
                        });
                    });
                    _.each(task.params, function (p, k) {
                        _.each(variables, function (v, label) {
                            if (typeof task.params[k] === 'string' && label[0] === '$') {
                                task.params[k] = replaceAll(task.params[k], label, JSON.stringify(v));
                            }
                        });
                    });
                }
                
                function executeTask(task) {
                    var newData;
                    data = _.cloneDeep(data);
                    task = _.cloneDeep(task);
                    // console.log('- before');
                    // console.log(task.params);
                    
                    if (task.cmd !== 'code') {
                        applyVariables(task, jsVariables);
                    }
                    parseArgsAndParams(task);
                    // console.log('- after');
                    // console.log(task.params);
                    newData = methods[task.cmd].process(
                        data,
                        global,
                        state,
                        variables,
                        result,
                        task.params,
                        task.args,
                        jsVariables
                    );
                    if (newData !== null && newData !== undefined) {
                        data = newData;
                    }
                }
                
                function runTask(task) {
                    var fArgs;
                    if (funcs[task.cmd] !== undefined) {
                        fArgs = {};
                        _.each(funcs[task.cmd].args, function (a, i) {
                            fArgs[a] = task.args[i];
                            jsVariables[a] = task.args[i];
                        });
                        _.each(funcs[task.cmd].tasks, function (t) {
                            // console.log('- before');
                            // console.log(t.params);
                            t = _.cloneDeep(t);
                            applyVariables(t, fArgs);
                            // console.log('- after');
                            // console.log(t.params);
                            runTask(t);
                        });
                    } else if (methods[task.cmd] !== undefined) {
                        executeTask(task);
                    } else {
                        console.error('ERROR: command \"' + task.cmd + '\" not found.');
                    }
                    
                }
                
                if (state.currentFuncs.length <= 0 || task.cmd === '<<<') {
                    runTask(task);
                }
                
            });
            storedData = data;
        });
        callback(result);
    }
    
    function renderRemote(dir, name, data, callback) {
        console.log('sending data to the remote server...');
        request.post({
            url: REMOTE_URL + '/',
            form: {
                data: JSON.stringify(data)
            }
        }, function (err, res, body) {
            var count = 0;
            function done() {
                var fileName, cmd;
                fileName = [options.dir, name].join('/');
                cmd = _.template('open <%= fileName %>.pdf <%= fileName %>.mp3');
                count += 1;
                if (count >= 3) {
                    cp.exec(cmd({fileName: fileName}));
                }
            }
            body = JSON.parse(body);
            if (body.id !== undefined) {
                _.each([
                    'mid',
                    'mp3',
                    'pdf'
                ], function (ext) {
                    var path, stream;
                    path = dir + '/' + [name, ext].join('.');
                    stream = fs.createWriteStream(path);
                    request.get({
                        url: [REMOTE_URL, 'file', ext, body.id].join('/')
                    }, function () {
                    }).pipe(stream);
                    stream.on('close', function () {
                        done();
                    });
                });
            }
            callback();
        });
    }
    
    function write(result, callback) {
        result = _.map(result, function (data, name) {
            return {
                name: name,
                data: data
            };
        });
        function writeToFile() {
            var data, renderFunc;
            if (result.length <= 0) {
                if (callback !== undefined) {
                    callback();
                }
                return;
            }
            data = result.shift();
            renderFunc = {
                local: midi.write,
                remote: renderRemote
            };
            renderFunc[RENDER_MODE](
                options.dir,
                data.name,
                data.data,
                function () {
                    writeToFile();
                }
            );
        }
        writeToFile();
    }
    
    function executeChain(funcs, input, callback) {
        funcs = _.clone(funcs);
        (function exec(input) {
            if (funcs.length <= 0) {
                if (typeof callback === 'function') {
                    callback();
                }
            } else {
                funcs.shift()(input, function (output) {
                    exec(output);
                });
            }
        }(input));
    }
    
    standByREPL = (function () {
        
        var preventEval, indented, nBrackets, sTmp;
        
        preventEval = false;
        nBrackets = 0;
        
        return function nextStandBy() {
            
            rlInterface.question((preventEval || indented) ? '... ' : '> ', function (input) {
                quitting = false;
                clear();
                if (indented) {
                    if (input === '') {
                        indented = false;
                        executeChain([
                            preprocess,
                            parse,
                            compile,
                            write,
                            nextStandBy
                        ], sTmp);
                        nextStandBy();
                        return;
                    } else {
                        input = ' ' + input;
                        sTmp.push(input);
                        nextStandBy();
                        return;
                    }
                }
                if (!preventEval && _.last(_.compact(input.split(' '))) === '\\' && !indented) {
                    indented = true;
                    input = _.compact(input.split(' '));
                    input.pop();
                    input = input.join(' ');
                    sTmp = [input];
                    nextStandBy();
                    return;
                }
                if (!preventEval && input.length === 1 && input[0] === '{') {
                    preventEval = true;
                    nextStandBy();
                    code = '';
                    nBrackets += 1;
                    return;
                }
                if (preventEval) {
                    nBrackets += _.filter(input, function (s) {
                        return s === '{';
                    }).length;
                    nBrackets -= _.filter(input, function (s) {
                        return s === '}';
                    }).length;
                    if (nBrackets <= 0) {
                        code += input.substring(0, input.lastIndexOf('}'));
                        console.log('// JavaScript Code');
                        code = beautify.beautifyJs(code);
                        console.log(code);
                        preventEval = false;
                        executeChain([
                            compile,
                            write,
                            nextStandBy
                        ], [[{
                            cmd: 'code',
                            params: {code: code}
                        }]]);
                    } else {
                        code += input + '\n';
                    }
                    nextStandBy();
                    return;
                }
                if (!preventEval) {
                    executeChain([
                        preprocess,
                        parse,
                        compile,
                        write,
                        nextStandBy
                    ], [input]);
                    return;
                }
            });
            
        };
        
    }());
    
    getOptions();
    loadLibraries();
    switch (PROCESS_MODE) {
    case 'file':
        clear();
        executeChain([
            readFile,
            preprocess,
            parse,
            compile,
            write
        ], file);
        break;
    case 'repl':
        console.log('Algorithmic Score Generator (version ' + VERSION + ')');
        rlInterface = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            completer: function (line) {
                var hits;
                hits = completions.filter(function (c) {
                    return c.indexOf(line) === 0;
                });
                return [hits.length ? hits : completions, line];
            }
        });
        rlInterface.on('SIGINT', function () {
            if (quitting) {
                process.exit(0);
            }
            quitting = true;
            process.stdout.write('\n(^C again to quit)\n> ');
        });
        standByREPL();
        break;
    }
    
}());

//EOF