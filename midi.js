/*jslint
    node:     true,
    unparam:  true,
    nomen:    true,
    undef:    false,
    stupid:   true
*/

'use strict';

var _, fs, cp, jsmidgen, async;

_        = require('lodash');
fs       = require('fs');
cp       = require('child_process');
jsmidgen = require('jsmidgen');
async    = require('async');

module.exports = {
    write: function (dir, name, data, callback) {
        
        var file, events, nData, tracks, timeOffsets, maxTime, asyncDone;
        
        nData = _.size(data);
        if (
            (nData <= 0) || (
                _.find(data, function (d) {
                    return d.type === 'note';
                }) === undefined
            )
        ) {
            return false;
        }
        
        file = new jsmidgen.File();
        
        events = [];
        _.each(data, function (d, i) {
            var e;
            e = _.clone(d);
            e.time = Math.max(e.time, 0);
            events.splice(i, 0, e);
            if (d.type === 'note') {
                e.type = 'noteon';
                e = _.clone(d);
                e.type = 'noteoff';
                e.time = Math.max(d.time + (d.duration || 0), e.time);
                events.push(e);
            }
        });
        
        events.sort(function (a, b) {
            var r = 0;
            if (a.time < b.time) {
                r = -1;
            } else if (a.time > b.time) {
                r = 1;
            } else {
                if (a.type === 'noteon' || b.type === 'noteoff') {
                    r = 1;
                } else if (a.type === 'noteoff' || b.type === 'noteon') {
                    r = -1;
                }
            }
            return r;
        });
        
        tracks = _.times(
            _.max(
                _.map(events, function (e) {
                    return e.track;
                })
            ) + 1,
            function () {
                return file.addTrack();
            }
        );
        
        timeOffsets = _.map(tracks, function () {
            return 0;
        });
        
        maxTime = 0;
        _.each(events, function (e) {
            var index, dt, cmd;
            index = e.track || 0;
            dt    = (e.time - timeOffsets[index]) * 128;
            timeOffsets[index] = e.time;
            maxTime = Math.max(e.time, maxTime);
            e.channel = index || 0;
            
            cmd = {
                noteon: {
                    method: 'addNoteOn',
                    args: [e.channel, e.pitch, dt, e.velocity]
                },
                noteoff: {
                    method: 'addNoteOff',
                    args: [e.channel, e.pitch, dt, e.velocity]
                },
                instrument: {
                    method: 'setInstrument',
                    args: [e.channel, e.value, dt]
                },
                tempo: {
                    method: 'setTempo',
                    args: [e.value, dt]
                },
                control: {
                    method: 'addEvent',
                    args: function () {
                        return [
                            new jsmidgen.Event({
                                type: jsmidgen.Event.CONTROLLER,
                                channel: e.channel,
                                param1: e.number,
                                param2: e.value,
                                time: dt
                            })
                        ];
                    }
                }
            }[e.type];
            
            if (typeof cmd.args === 'function') {
                cmd.args = cmd.args();
            }
            jsmidgen.Track.prototype[cmd.method].apply(tracks[index], cmd.args);
        });
        
        _.each(tracks, function (t, i) {
            t.setInstrument(0, 0, (maxTime - timeOffsets[i]) * 128 + 256);
        });
        
        asyncDone = (function () {
            var count = 0;
            return function () {
                count += 1;
                if (count >= 2) {
                    if (typeof callback === 'function') {
                        callback();
                    }
                }
            };
        }());
        
        function createExecFunc(cmd) {
            return function (callback) {
                cmd = _.template(cmd)({
                    name: name,
                    dir: dir
                });
                // console.log('$ ' + cmd);
                cp.exec(cmd, {}, function (err, stdout) {
                    // console.log(err);
                    // console.log(stdout);
                    callback();
                });
            };
        }
        
        function asyncCallback(err) {
            if (err) {
                throw err;
            }
            // console.log('all done.');
            asyncDone();
        }
        
        cp.exec('mkdir -p ' + dir, function (err) {
            fs.writeFileSync([dir, 'output.mid'].join('/'), file.toBytes(), 'binary');
            cp.exec(
                'cp <%= dir %>/output.mid <%= dir %>/<%= name %>.mid',
                function (err) {
                    async.series(
                        _.map(
                            [
                                'midi2ly -o <%= dir %>/output-midi.ly <%= dir %>/output.mid',
                                'echo \\\\header { tagline = \\\"\\\" } >> <%= dir %>/output-midi.ly',
                                'lilypond -o <%= dir %>/<%= name %> <%= dir %>/output-midi.ly',
                                'open <%= dir %>/<%= name %>.pdf',
                                'rm <%= dir %>/output-midi.ly <%= dir %>/<%= name %>.midi'
                        
                            ],
                            createExecFunc
                        ),
                        asyncCallback
                    );
                    async.series(
                        _.map(
                            [
                                'fluidsynth -g 1.0 -l -i -a file -z 2048 -F <%= dir %>/output.raw titanic.sf2 <%= dir %>/output.mid',
                                'sox -b 16 -c 2 -e signed-integer -r 44100 <%= dir %>/output.raw <%= dir %>/<%= name %>.mp3 pad 0 1 gain -n -3',
                                'open <%= dir %>/<%= name %>.mp3',
                                'rm <%= dir %>/output.raw'
                            ],
                            createExecFunc
                        ),
                        asyncCallback
                    );
                }
            );
        });
        
        return true;
        
    }
};

//EOF