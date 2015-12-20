/*jslint
    node: true,
    nomen: true,
    undef: true,
    unparam: true,
    stupid: true,
    white: true
*/

'use strict';

var _ = require('lodash');
var util = require('../util');

function sortNotes(data) {
    return _.sortBy(data, function (d) {
        return d.time;
    });
}

module.exports = {
    set_state: {
        args: [
            {label: 'target', type: 'string', defaultValue: 'track'},
            {label: 'value', type: 'float', defaultValue: 0}
        ],
        process: function (data, global, state, variables, result, params) {
            state[params.target] = params.value;
        }
    },
    clear_state: {
        args: [
            {label: 'target', type: 'string', defaultValue: 'track'}
        ],
        process: function (data, global, state, variables, result, params) {
            delete state[params.target];
        }
    },
    update_all: {
        args: [
            {label: 'target', type: 'string', defaultValue: 'pitch'},
            {label: 'value', type: 'float', defaultValue: 1},
            {label: 'pattern', type: 'string', defaultValue: '*'}
        ],
        process: function (data, global, state, variables, result, params) {
            _.each(data, function (d, i) {
                // if (!util.checkPattern(params.pattern, i)) {
                //     return;
                // }
                if (!util.checkFilter(d, params, i)) {
                    return;
                }
                d[params.target] = params.value;
            });
            return sortNotes(data);
        }
    },
    update: {
        args: [
            {label: 'index', type: 'integer', defaultValue: 0},
            {label: 'target', type: 'string', defaultValue: 'pitch'},
            {label: 'value', type: 'float', defaultValue: 1}
        ],
        process: function (data, global, state, variables, result, params) {
            if (data[params.index] === undefined) {
                return data;
            }
            data[params.index][params.target] = params.value;
            return sortNotes(data);
        }
    },
    add: {
        args: [
            {label: 'index', type: 'integer', defaultValue: 0},
            {label: 'target', type: 'string', defaultValue: 'pitch'},
            {label: 'value', type: 'float', defaultValue: 1}
        ],
        process: function (data, global, state, variables, result, params) {
            if (data[params.index] === undefined) {
                return data;
            }
            data[params.index][params.target] += params.value;
            return sortNotes(data);
        }
    },
    add_all: {
        args: [
            {label: 'target', type: 'string', defaultValue: 'pitch'},
            {label: 'value', type: 'float', defaultValue: 1},
            {label: 'pattern', type: 'string', defaultValue: '*'}
        ],
        process: function (data, global, state, variables, result, params) {
            _.each(data, function (d, i) {
                if (
                    d[params.target] === undefined ||
                        !util.checkFilter(d, params, i)
                ) {
                    return;
                }
                d[params.target] += params.value;
            });
            return sortNotes(data);
        }
    },
    track: {
        args: [
            {label: 'value', type: 'integer', defaultValue: 0}
        ],
        process: function (data, global, state, variables, result, params) {
            state.track = params.value;
            return data;
        }
    },
    note: {
        args: [
            {label: 'time', type: 'float', defaultValue: 0},
            {label: 'duration', type: 'float', defaultValue: 1},
            {label: 'pitch', type: 'integer', defaultValue: 60},
            {label: 'velocity', type: 'integer', defaultValue: 80}
        ],
        process: function (data, global, state, variables, result, params) {
            data.push({
                type    : 'note',
                track   : state.track,
                channel : state.channel,
                time    : params.time,
                duration: params.duration,
                pitch   : params.pitch,
                velocity: params.velocity
            });
            return sortNotes(data);
        }
    },
    instrument: {
        args: [
            {label: 'track', type: 'integer', defaultValue: 0},
            {label: 'value', type: 'integer', defaultValue: 0}
        ],
        process: function (data, global, state, variables, result, params) {
            if (global.instrument === undefined) {
                global.instrument = {};
            }
            global.instrument[params.track] = params.value;
            return data;
        }
    },
    tempo: {
        args: [
            {label: 'time', type: 'float', defaultValue: 0},
            {label: 'value', type: 'float', defaultValue: 0}
        ],
        process: function (data, global, state, variables, result, params) {
            if (global.tempo === undefined) {
                global.tempo = {};
            }
            global.tempo[params.time] = params.value;
            return data;
        }
    },
    write: {
        args: [
            {label: 'name', type: 'string', defaultValue: 'out'},
            {label: 'offset', type: 'float', defaultValue: 0}
        ],
        process: function (data, global, state, variables, result, params) {
            if (result[params.name] === undefined) {
                result[params.name] = [];
            }
            data = _.map(data, function (d) {
                if (d.time !== undefined) {
                    d.time += params.offset;
                }
                return d;
            });
            data = sortNotes(data);
            _.each(global.instrument, function (v, k) {
                data.push({
                    type    : 'instrument',
                    track   : parseInt(k, 10),
                    channel : parseInt(k, 10),
                    time    : 0,
                    value   : v
                });
            });
            _.each(global.pan, function (v, k) {
                data.push({
                    type    : 'control',
                    track   : parseInt(k, 10),
                    channel : parseInt(k, 10),
                    time    : 0,
                    number  : 10,
                    value   : v
                });
            });
            _.each(global.expression, function (v, track) {
                _.each(v, function (v) {
                    data.push({
                        type    : 'control',
                        track   : parseInt(track, 10),
                        channel : parseInt(track, 10),
                        time    : v.time,
                        number  : 11,
                        value   : v.value
                    });
                });
            });
            _.each(global.tempo, function (v, k) {
                data.push({
                    type: 'tempo',
                    time: parseFloat(k),
                    value: v,
                    track: 0
                });
            });
            result[params.name] = result[params.name].concat(data);
            return null;
        }
    },
    articulation: {
        args: [
            {label: 'pattern', type: 'string', defaultValue: '*'}
        ],
        process: function (data, global, state, variables, result, params) {
            _.each(data, function (d, i) {
                if (!util.checkFilter(d, params, i)) {
                    return;
                }
                if (d.articulation !== undefined && d.duration !== undefined) {
                    d.duration *= d.articulation;
                    delete d.articulation;
                }
            });
            return data;
        }
    },
    clip: {
        args: [
            {label: 'target', type: 'string', defaultValue: 'pitch'},
            {label: 'min', type: 'float', defaultValue: 60},
            {label: 'max', type: 'float', defaultValue: 64},
            {label: 'pattern', type: 'string', defaultValue: '*'}
        ],
        process: function (data, global, state, variables, result, params) {
            _.each(data, function (d, i) {
                if (
                    d[params.target] === undefined ||
                        !util.checkFilter(d, params, i)
                ) {
                    return;
                }
                d[params.target] = Math.max(Math.min(d[params.target], params.max), params.min);
            });
            return sortNotes(data);
        }
    },
    compact: {
        args: [],
        process: function (data, global, state, variables, result, params) {
            var dup, subtraction;
            dup = _.cloneDeep(data);
            _.each(data, function (d, i) {
                var dt;
                if (i === 0) {
                    subtraction = d.time;
                } else {
                    dt = d.time - (dup[i - 1].time + dup[i - 1].duration);
                    subtraction += Math.max(dt, 0);
                }
                d.time -= subtraction;
            });
            return sortNotes(data);
        }
    },
    concat: {
        args: [
            {label: 'sequences', type: 'array', defaultValue: []},
            {label: 'interval', type: 'array', defaultValue: [0]}
        ],
        process: function (data, global, state, variables, result, params) {
            
            var groups, offsetTime, newData;
            groups = _.map(params.sequences, function (a) {
                return variables[a];
            });
            offsetTime = 0;
            newData = [];
            _.each(groups, function (group, i) {
                var notes, endTime;
                notes = _.cloneDeep(group);
                endTime = _.max(
                    _.map(notes, function (n) {
                        return n.time + n.duration;
                    })
                );
                _.each(notes, function (n) {
                    if (n.time === undefined) {
                        return;
                    }
                    n.time += offsetTime;
                });
                newData = newData.concat(notes);
                offsetTime += endTime;
                offsetTime += parseFloat(params.interval[i % params.interval.length]);
            });

            return sortNotes(newData);
        }
    },
    expression: {
        args: [
            {label: 'track', type: 'integer', defaultValue: 0},
            {label: 'time', type: 'float', defaultValue: 0},
            {label: 'value', type: 'integer', defaultValue: 64}
        ],
        process: function (data, global, state, variables, result, params) {
            if (global.expression === undefined) {
                global.expression = {};
            }
            if (global.expression[params.track] === undefined) {
                global.expression[params.track] = [];
            }
            global.expression[params.track].push({
                time: params.time,
                value: params.value
            });
            return data;
        }
    },
    filter: {
        args: [
            {label: 'target', type: 'string', defaultValue: 'pitch'},
            {label: 'min', type: 'float', defaultValue: 63},
            {label: 'max', type: 'float', defaultValue: 68},
            {label: 'pattern', type: 'string', defaultValue: '*'},
            {label: 'end_mode', type: 'string', defaultValue: 'inclusive'}
        ],
        process: function (data, global, state, variables, result, params) {
            var rejection;
            rejection = _.filter(data, function (d, i) {
                var r;
                if (
                    !util.checkFilter(d, params, i) ||
                        d[params.target] === undefined
                ) {
                    return true;
                }
                if (params.end === 'inclusive') {
                    r = d[params.target] < params.min || d[params.target] > params.max;
                } else {
                    r = d[params.target] < params.min || d[params.target] >= params.max;
                }
                return r;
            });
            data = _.difference(data, rejection);
            return sortNotes(data);
        }
    },
    filter_out: {
        args: [
            {label: 'target', type: 'string', defaultValue: 'pitch'},
            {label: 'min', type: 'float', defaultValue: 63},
            {label: 'max', type: 'float', defaultValue: 68},
            {label: 'pattern', type: 'string', defaultValue: '*'},
            {label: 'end_mode', type: 'string', defaultValue: 'inclusive'}
        ],
        process: function (data, global, state, variables, result, params) {
            var selection;
            selection = _.filter(data, function (d, i) {
                var r;
                if (
                    !util.checkFilter(d, params, i) ||
                        d[params.target] === undefined
                ) {
                    return true;
                }
                if (params.end === 'inclusive') {
                    r = d[params.target] < params.min || d[params.target] > params.max;
                } else {
                    r = d[params.target] < params.min || d[params.target] >= params.max;
                }
                return r;
            });
            return sortNotes(selection);
        }
    },
    invert: {
        args: [
            {label: 'pattern', type: 'string', defaultValue: '*'}
        ],
        process: function (data, global, state, variables, result, params) {
            var pitches, center;
            pitches = _.pluck(data, 'pitch');
            center = (_.min(pitches) + _.max(pitches)) / 2;
            _.each(data, function (d, i) {
                if (
                    d.pitch === undefined ||
                        !util.checkFilter(d, params, i)
                ) {
                    return;
                }
                d.pitch = Math.round(center * 2 - d.pitch);
            });
            return data;
        }
    },
    limit_pitch: {
        args: [
            {label: 'min', type: 'float', defaultValue: 60},
            {label: 'max', type: 'float', defaultValue: 64},
            {label: 'pattern', type: 'string', defaultValue: '*'}
        ],
        process: function (data, global, state, variables, result, params) {
            _.each(data, function (d) {
                if (d.pitch === undefined) {
                    return;
                }
                // console.log(d.pitch);
                if (d.pitch >= params.min && d.pitch <= params.max) {
                    return;
                }
                if (d.pitch < params.min) {
                    d.pitch += Math.round(Math.max(params.min - d.pitch - 5, 0) / 12 + 0.45) * 12;
                } else if (d.pitch > params.max) {
                    d.pitch -= Math.round(Math.max(d.pitch - params.max - 5, 0) / 12 + 0.45) * 12;
                }
            });
            return data;
        }
    },
    line: {
        args: [
            {label: 'target', type: 'string', defaultValue: 'pitch'},
            {label: 'from', type: 'float', defaultValue: -12},
            {label: 'to', type: 'float', defaultValue: 12},
            {label: 'mode', type: 'string', defaultValue: 'add'},
            {label: 'pattern', type: 'string', defaultValue: '*'}
        ],
        process: function (data, global, state, variables, result, params) {
            var time, tMin, tMax;
            time = _.pluck(data, 'time');
            tMin = _.min(time);
            tMax = _.max(time);
            _.each(data, function (d, i) {
                var tp, dv;
                if (!util.checkFilter(d, params, i)) {
                    return;
                }
                tp = (d.time - tMin) / (tMax - tMin);
                dv = (params.to - params.from) * tp + params.from;
                switch (params.mode) {
                case 'add':
                    d[params.target] += dv;
                    break;
                case 'multiply':
                    d[params.target] *= dv;
                    break;
                case 'overwrite':
                default:
                    d[params.target] = dv;
                    break;
                }
            });
            return sortNotes(data);
        }
    },
    monophony: {
        args: [
            {label: 'type', type: 'string', defaultValue: 'A'},
            {label: 'criterion', type: 'string', defaultValue: 'pitch'}
        ],
        process: function (data, global, state, variables, result, params) {
            
            var func;
            function sort(array) {
                array.sort(
                    function (a, b) {
                        if (a < b) { return -1; }
                        if (a > b) { return 1;  }
                        return 0;
                    }
                );
            }
            
            function monoA(data) {
                var newData, same, winner;
                newData = [];
                while (data.length > 0) {
                    same = _.filter(data, function (d) {
                        return d.time === data[0].time;
                    });
                    if (same.length > 1) {
                        winner = _.max(same, function (d) {
                            return d[params.criterion];
                        });
                        newData.push(winner);
                    } else {
                        newData.push(data[0]);
                    }
                    data = _.difference(data, same);
                }
                return newData;
            }
            
            function monoB(data) {
                var timePoints, sections;
                timePoints = _.union(
                    _.map(data, function (d) {
                        return d.time;
                    }),
                    _.map(data, function (d) {
                        return d.time + d.duration;
                    })
                );
                sort(timePoints);
                sections = [];
                _.times(timePoints.length - 1, function (i) {
                    sections.push({
                        a: timePoints[i],
                        b: timePoints[i + 1]
                    });
                });
                _.each(sections, function (timePoint) {
                    var correspondings, highest;
                    correspondings = _.filter(data, function (v, i) {
                        return (v.time <= timePoint.a) && (v.time + v.duration >= timePoint.b);
                    });
                    if (correspondings.length <= 1) {
                        return;
                    }
                    highest = _.max(correspondings, function (d) {
                        return d[params.criterion];
                    });
                    _.each(_.without(correspondings, highest), function (d) {
                        var dA, dB;
                        dA = _.cloneDeep(d);
                        dB = _.cloneDeep(d);
                        dA.duration = timePoint.a - d.time;
                        dB.time = timePoint.b;
                        dB.duration = d.time + d.duration - timePoint.b;
                        if (dA.duration > 0) {
                            data.push(dA);
                        }
                        if (dB.duration > 0) {
                            data.push(dB);
                        }
                        data = _.without(data, d);
                    });
                });
                
                return data;
            }
            
            func = {
                A: monoA,
                B: monoB
            }[params.type.toUpperCase()];
            if (func !== undefined) {
                data = func(data);
            }
            return sortNotes(data);
        }
    },
    no_repetition: {
        args: [],
        process: function (data, global, state, variables, result, params) {
            var removed;
            function getPairs(n) {
                var i, j, p = [];
                for (i = 0; i < n - 1; i += 1) {
                    for (j = i + 1; j < n; j += 1) {
                        p.push([i, j]);
                    }
                }
                return p;
            }
            removed = true;
            function remove() {
                if (data.length <= 1 || !removed) {
                    return;
                }
                removed = false;
                _.each(getPairs(data.length), function (p) {
                    var a, b, ends;
                    if (removed) {
                        return;
                    }
                    a = data[p[0]];
                    b = data[p[1]];
                    ends = {
                        a: a.time + a.duration,
                        b: b.time + b.duration
                    };
                    if (
                        a.track === b.track &&
                            a.pitch === b.pitch &&
                                b.time <= ends.a
                    ) {
                        a.duration = _.max(ends) - a.time;
                        data = _.without(data, b);
                        removed = true;
                    }
                });
                remove();
            }
            remove();
            return sortNotes(data);
        }
    },
    pan: {
        args: [
            {label: 'track', type: 'integer', defaultValue: 0},
            {label: 'value', type: 'integer', defaultValue: 64}
        ],
        process: function (data, global, state, variables, result, params) {
            if (global.pan === undefined) {
                global.pan = {};
            }
            global.pan[params.track] = params.value;
            return sortNotes(data);
        }
    },
    remove: {
        args: [
            {label: 'index', type: 'integer', defaultValue: 0}
        ],
        process: function (data, global, state, variables, result, params) {
            data = _.without(data, data[params.index]);
            return sortNotes(data);
        }
    },
    remove_all: {
        args: [
            {label: 'pattern', type: 'string', defaultValue: '*'}
        ],
        process: function (data, global, state, variables, result, params) {
            data = _.filter(data, function (d, i) {
                return !util.checkFilter(d, params, i);
            });
            return sortNotes(data);
        }
    },
    repeat: {
        args: [
            {label: 'n', type: 'integer', defaultValue: 3},
            {label: 'interval', type: 'array', defaultValue: [1]},
            {label: 'transpose', type: 'array', defaultValue: [1]}
        ],
        process: function (data, global, state, variables, result, params) {
            var endPoint, timeOffset, pitchOffset, newData;
            if (params.n < 2) {
                return;
            }
            endPoint = _.max(
                _.map(data, function (d) {
                    return d.time + d.duration;
                })
            );
            timeOffset = data[0].time;
            pitchOffset = 0;
            newData = [];
            if (typeof params.interval !== 'object') {
                params.interval = [params.interval];
            }
            if (typeof params.transpose !== 'object') {
                params.transpose = [params.transpose];
            }
            _.times(params.n - 1, function (i) {
                timeOffset += parseFloat(params.interval[i % params.interval.length], 10);
                pitchOffset += parseInt(params.transpose[i % params.transpose.length], 10);
                _.each(data, function (d) {
                    var newNote;
                    newNote = _.cloneDeep(d);
                    newNote.time = d.time + timeOffset;
                    newNote.pitch = d.pitch + pitchOffset;
                    newData.push(newNote);
                });
            });
            data = data.concat(newData);
            return sortNotes(data);
        }
    },
    reverse: {
        args: [
            {label: 'pattern', type: 'string', defaultValue: '*'}
        ],
        process: function (data, global, state, variables, result, params) {
            var endPoint;
            endPoint = _.max(
                _.map(data, function (d) {
                    return d.time + d.duration;
                })
            );
            _.each(data, function (d, i) {
                if (!util.checkFilter(d, params, i)) {
                    return;
                }
                d.time = endPoint - (d.time + d.duration);
            });
            return sortNotes(data);
        }
    },
    scale: {
        args: [
            {label: 'pitch_set', type: 'array', defaultValue: [0, 4, 5, 7, 11]},
            {label: 'key', type: 'integer', defaultValue: 0},
            {label: 'pattern', type: 'string', defaultValue: '*'},
            {label: 'harmonic_threshold', type: 'float', defaultValue: 0.5}
        ],
        process: function (data, global, state, variables, result, params) {
            var points;
            function sort(array) {
                array.sort(
                    function (a, b) {
                        if (a < b) { return -1; }
                        if (a > b) { return 1;  }
                        return 0;
                    }
                );
            }
            function getScale(p, key) {
                var first, last;
                p = _.map(p, function (k) {
                    return (k + key) % 12;
                });
                sort(p);
                first = _.first(p);
                last  = _.last(p);
                p.push(first + 12);
                p.unshift(last - 12);
                return p;
            }
            params.pitch_set = _.map(params.pitch_set, function (v) {
                return parseInt(v, 10);
            });
            points = getScale(params.pitch_set, params.key);
            _.each(data, function (d) {
                var p, i;
                if (
                    d.harmonic_importance === undefined ||
                        d.harmonic_importance > this.harmonic_threshold
                ) {
                    p = d.pitch % 12;
                    for (i = 1; i < points.length; i += 1) {
                        if (p < points[i]) {
                            d.pitch += ((p < (points[i - 1] + points[i]) / 2) ? points[i - 1] : points[i]) - p;
                            break;
                        }
                    }
                }
            });
            return data;
        }
    },
    shift: {
        args: [
            {label: 'amount', type: 'integer', defaultValue: 2},
            {label: 'pattern', type: 'string', defaultValue: '*'},
            {label: 'mode', type: 'string', defaultValue: 'shift'}
        ],
        process: function (data, global, state, variables, result, params) {
            var funcs = {
                fixed: function () {
                    var subData, tmp;
                    subData = _.filter(data, function (d, i) {
                        return util.checkFilter(d, params, i);
                    });
                    tmp = _.cloneDeep(subData);
                    _.each(subData, function (d, i) {
                        var original = tmp[(i - params.amount + subData.length) % subData.length];
                        d.time = original.time;
                        d.duration = original.duration;
                    });
                },
                shift: function () {
                    var subData, t = {};
                    subData = _.filter(data, function (d, i) {
                        return util.checkFilter(d, params, i);
                    });
                    t.start = _.first(subData).time;
                    t.end = _.last(subData).time + _.last(subData).duration;
                    t.len = t.end - t.start;
                    t.shift = subData[(-params.amount + subData.length) % subData.length].time - t.start;
                    _.each(subData, function (d) {
                        d.time = (d.time - t.start - t.shift + t.len) % t.len + t.start;
                    });
                }
            };
            if (funcs[params.mode] !== undefined) {
                funcs[params.mode]();
            }
            return sortNotes(data);
        }
    },
    shuffle: {
        args: [
            {label: 'pattern', type: 'string', defaultValue: '*'}
        ],
        process: function (data, global, state, variables, result, params) {
            var pitches, subData;
            subData = _.filter(data, function (d, i) {
                return util.checkFilter(d, params, i);
            });
            pitches = _.shuffle(_.pluck(subData, 'pitch'));
            _.each(subData, function (d, i) {
                d.pitch = pitches[i];
            });
            return data;
        }
    },
    stretch: {
        args: [
            {label: 'stretch', type: 'float', defaultValue: 2},
            {label: 'quantize', type: 'float', defaultValue: 1}
        ],
        process: function (data, global, state, variables, result, params) {
            _.each(data, function (d) {
                var endTime;
                d.time *= params.stretch;
                d.duration *= params.stretch;
                if (params.quantize > 0) {
                    endTime = d.time + d.duration;
                    d.time = Math.floor(d.time / params.quantize) * params.quantize;
                    endTime = Math.round(endTime / params.quantize) * params.quantize;
                    d.duration = endTime - d.time;
                }
            });
            return sortNotes(data);
        }
    },
    legato: {
        args: [
            {label: 'max_interval', type: 'float', defaultValue: 2}
        ],
        process: function (data, global, state, variables, result, params) {
            var rejection, i, a, b, endA, endB;
            rejection = [];
            for (i = 0; i < data.length - 1; i += 1) {
                a = data[i];
                b = data[i + 1];
                endA = a.time + a.duration;
                endB = b.time + b.duration;
                if (b.time - endA <= params.max_interval) {
                    if (a.pitch === b.pitch) {
                        b.time = a.time;
                        b.duration = endB - a.time;
                        rejection.push(a);
                    } else {
                        a.duration = b.time - a.time;
                    }
                }
            }
            data = _.difference(data, rejection);
            return sortNotes(data);
        }
    },
    trim: {
        args: [
            {label: 'from', type: 'integer', defaultValue: 1},
            {label: 'to', type: 'integer', defaultValue: 3},
            {label: 'remove_offset', type: 'string', defaultValue: 'yes'}
        ],
        process: function (data, global, state, variables, result, params) {
            var moveOver, rejection, head, moveAmount;
            moveOver = (params.remove_offset === 'yes') || (params.remove_offset === 'true');
            head = _.first(data).time;
            rejection = [];
            _.each(data, function (d, i) {
                if (i < params.from || i > params.to) {
                    rejection.push(d);
                }
            });
            data = _.difference(data, rejection);
            if (moveOver) {
                moveAmount = _.first(data).time - head;
                _.each(data, function (d) {
                    d.time -= moveAmount;
                });
            }
            return sortNotes(data);
        }
    },
    trim_last: {
        args: [
            {label: 'n', type: 'integer', defaultValue: 3},
            {label: 'remove_offset', type: 'string', defaultValue: 'yes'}
        ],
        process: function (data, global, state, variables, result, params) {
            var moveOver, rejection, offset;
            moveOver = (params.remove_offset === 'yes') || (params.remove_offset === 'true');
            rejection = [];
            _.each(data, function (d, i) {
                if (i < data.length - params.n) {
                    rejection.push(d);
                }
            });
            data = _.difference(data, rejection);
            if (moveOver) {
                offset = data[0].time;
                _.each(data, function (d) {
                    d.time -= offset;
                });
            }
            return data;
        }
    },
    wrap: {
        args: [
            {label: 'min', type: 'integer', defaultValue: 60},
            {label: 'max', type: 'integer', defaultValue: 64},
            {label: 'pattern', type: 'string', defaultValue: '*'}
        ],
        process: function (data, global, state, variables, result, params) {
            _.each(data, function (d, index) {
                var range, offset, i, p, candidates;
                if (!util.checkFilter(d, params, index)) {
                    return;
                }
                range = params.max - params.min + 1;
                offset = d.pitch - params.min;
                i = offset % range;
                if (i < 0) {
                    i = range - i;
                }
                i += params.min;
                p = i + (d.pitch % 12) - (i % 12);
                candidates = [
                    p - i,
                    Math.abs(p + 12 - i),
                    Math.abs(p - 12 - i)
                ];
                d.pitch = p + [0, 12, -12][_.indexOf(candidates, _.min(candidates))];
            });
            return data;
        }
    }
};