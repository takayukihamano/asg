/*jslint
    node: true,
    nomen: true,
    undef: true,
    unparam: true,
    stupid: true,
    evil: true
*/

'use strict';

var _ = require('lodash');
var util = require('../util');
var fs = require('fs');

function sortNotes(data) {
    return _.sortBy(data, function (d) {
        return d.time;
    });
}

function dataToString(input, meta) {
    var labels, data;
    labels = ['track', 'channel', 'time', 'duration', 'pitch', 'velocity'];
    data = {
        size: _.size(input),
        labels: labels,
        data: [],
        meta: {}
    };
    if (meta.instrument !== undefined) {
        data.meta.instrument = meta.instrument;
    }
    if (meta.pan !== undefined) {
        data.meta.pan = meta.pan;
    }
    _.each(input, function (v) {
        data.data.push(_.map(labels, function (label) {
            return v[label];
        }));
    });
    return new Buffer(JSON.stringify(data)).toString('base64');
}

function stringToData(input) {
    var data;
    try {
        input = JSON.parse(new Buffer(input, 'base64').toString());
        data = _.map(input.data, function (v) {
            var d = {};
            _.each(input.labels, function (label, i) {
                d[label] = v[i];
            });
            if (d.type === undefined) {
                d.type = 'note';
            }
            return d;
        });
        return data;
    } catch (err) {
        console.log(err);
    }
}

module.exports = {
    'show_stacks': {
        args: [],
        description: 'スタックのリストを表示する。',
        process: function (data, global, state, variables, result, params) {
            console.log(_.keys(variables).join('\n'));
            return data;
        }
    },
    'delete': {
        args: [
            {label: 'target', type: 'string'}
        ],
        description: '指定したスタックを削除する。',
        process: function (data, global, state, variables, result, params) {
            if (variables[params.target] !== undefined) {
                delete variables[params.target];
            }
            return data;
        }
    },
    '=>': {
        args: [
            {label: 'target', type: 'string'}
        ],
        description: '現在のスタックに名前をつけて保存する。',
        process: function (data, global, state, variables, result, params) {
            variables[params.target] = data;
            return data;
        }
    },
    '=>+': {
        args: [
            {label: 'target', type: 'string'},
            {label: 'time', type: 'float', defaultValue: 0}
        ],
        description: '指定したスタックに現在のスタックの内容を追加する。',
        process: function (data, global, state, variables, result, params) {
            if (variables[params.target] === undefined) {
                variables[params.target] = [];
            }
            _.each(data, function (d) {
                if (d.time === undefined) {
                    return;
                }
                d.time += params.time;
            });
            variables[params.target] = variables[params.target].concat(data);
            return data;
        }
    },
    '<=': {
        args: [
            {label: 'target', type: 'string'},
            {label: 'time', type: 'float', defaultValue: 0}
        ],
        description: '指定したスタックの内容を現在のスタックに取り込む。',
        process: function (data, global, state, variables, result, params) {
            var addition;
            if (variables[params.target] !== undefined) {
                addition = _.cloneDeep(variables[params.target]);
                _.each(addition, function (d) {
                    if (d.time === undefined) {
                        return;
                    }
                    d.time += params.time;
                });
                data = data.concat(addition);
            }
            return sortNotes(data);
        }
    },
    '>>>': {
        args: [
            {label: 'label', type: 'string'},
            {label: 'args', type: 'array', defaultValue: []}
        ],
        process: function (data, global, state, variables, result, params, args) {
            global.createFunc(params.label, args.splice(1));
            state.currentFuncs.push(params.label);
            return data;
        }
    },
    '<<<': {
        args: [
            {label: 'label', type: 'string'}
        ],
        process: function (data, global, state, variables, result, params) {
            state.currentFuncs = _.without(state.currentFuncs, params.label);
            return data;
        }
    },
    'code': {
        args: [
            {label: 'code', type: 'string'}
        ],
        process: function (data, global, state, variables, result, params, args, jsVariables) {
            function exec() {
                eval(params.code);
            }
            exec.call(jsVariables);
            return data;
        }
    },
    'push': {
        args: [],
        process: function (data, global, state, variables, result, params, args, jsVariables) {
            global.stack.push(_.cloneDeep(data));
            return data;
        }
    },
    'pop': {
        args: [],
        process: function (data, global, state, variables, result, params, args, jsVariables) {
            data = global.stack.pop();
            return data;
        }
    },
    'print': {
        args: [
            {label: 'name', type: 'string', defaultValue: '-'}
        ],
        process: function (data, global, state, variables, result, params, args, jsVariables) {
            var d;
            if (params.name === '-') {
                d = data;
            } else {
                if (variables[params.name] === undefined) {
                    console.log('ERROR: variable \"%s\" not found.', params.name);
                    return data;
                }
                d = variables[params.name];
            }
            if (_.size(d) > 0) {
                console.log('#index\ttime\tdur.\ttrack\tpitch\tvel.');
                _.each(sortNotes(d), function (v, i) {
                    console.log([
                        '#' + i,
                        typeof v.time === 'number' ? v.time.toFixed(3) : v.time,
                        typeof v.duration === 'number' ? v.duration.toFixed(3) : v.duration,
                        v.track,
                        typeof v.pitch === 'number' ? v.pitch.toFixed(2) : v.pitch,
                        v.velocity
                    ].join('\t'));
                });
            }
            return data;
        }
    },
    'exit': {
        args: [],
        process: function (data, global, state, variables, result, params, args, jsVariables) {
            process.exit(0);
        }
    },
    'to_string': {
        args: [
            {label: 'name', type: 'string', defaultValue: '-'}
        ],
        process: function (data, global, state, variables, result, params, args, jsVariables) {
            var d, labels, values;
            if (params.name === '-') {
                d = data;
            } else {
                if (variables[params.name] === undefined) {
                    console.log('ERROR: variable \"%s\" not found.', params.name);
                    return data;
                }
                d = variables[params.name];
            }
            console.log(dataToString(d, global));
            return data;
        }
    },
    'from_string': {
        args: [
            {label: 'string', type: 'string'},
            {label: 'name', type: 'string', defaultValue: '-'}
        ],
        process: function (data, global, state, variables, result, params, args, jsVariables) {
            var dataToAppend;
            if (params.string === undefined) {
                return data;
            }
            dataToAppend = stringToData(params.string);
            if (params.name === '-') {
                data = sortNotes(data.concat(dataToAppend));
            } else {
                variables[params.name] = sortNotes(dataToAppend);
            }
            return data;
        }
    },
    'save_string': {
        args: [
            {label: 'file', type: 'string', defaultValue: 'out.acs'},
            {label: 'name', type: 'string', defaultValue: '-'}
        ],
        process: function (data, global, state, variables, result, params, args, jsVariables) {
            var d, labels, values;
            if (params.name === '-') {
                d = data;
            } else {
                if (variables[params.name] === undefined) {
                    console.log('ERROR: variable \"%s\" not found.', params.name);
                    return data;
                }
                d = variables[params.name];
            }
            try {
                fs.writeFileSync([global.dir, params.file].join('/'), dataToString(d, global));
            } catch (e) {
                console.log(e);
            }
            return data;
        }
    },
    'load_string': {
        args: [
            {label: 'file', type: 'string', defaultValue: 'out.acs'},
            {label: 'name', type: 'string', defaultValue: '-'}
        ],
        process: function (data, global, state, variables, result, params, args, jsVariables) {
            var string, dataToAppend, tmp;
            try {
                string = fs.readFileSync([global.dir, params.file].join('/')).toString();
                if (string === undefined) {
                    return data;
                }
            } catch (e) {
                console.log(e);
            }
            dataToAppend = stringToData(string);
            if (params.name === '-') {
                data = sortNotes(data.concat(dataToAppend));
            } else {
                variables[params.name] = sortNotes(dataToAppend);
            }
            return data;
        }
    },
    'history': {
        args: [
            {label: 'n', type: 'integer', defaultValue: 10}
        ],
        process: function (data, global, state, variables, result, params, args, jsVariables) {
            console.log(
                _.slice(
                    global.cmdHistory,
                    Math.max(_.size(global.cmdHistory) - params.n, 0)
                ).join('\n')
            );
            return data;
        }
    },
    '?': {
        args: [
            {label: 'name', type: 'string', defaultValue: ''}
        ],
        process: function (data, global, state, variables, result, params, args, jsVariables) {
            var m;
            if (params.name === undefined || params.name === '') {
                return data;
            }
            m = global.methods[params.name];
            if (m !== undefined) {
                if (m.description !== undefined) {
                    console.log(m.description);
                }
                console.log('arguments:');
                _.each(m.args, function (v, i) {
                    console.log(
                        '#' + i + ' ' + v.label + ' (' + v.type + (
                            v.defaultValue !== undefined ? (', default: ' + (
                                typeof v.defaultValue === 'string' ? ('\'' + v.defaultValue + '\'') : v.defaultValue
                            ) + ')') : ')'
                        )
                    );
                });
            }
            return data;
        }
    }
};
