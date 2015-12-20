var _ = require('lodash');

module.exports = {
    checkPattern: function (pattern, index) {
        return pattern[index % pattern.length] === '*';
    },
    checkFilter: function (data, params, index) {
        var passed, pattern;
        passed = true;
        pattern = params['@pattern'];
        if (pattern !== undefined) {
            passed = passed && pattern[index % pattern.length] === '*';
        }
        _.each(
            ['pitch', 'time', 'duration', 'velocity'],
            function (k) {
                var v;
                if (data[k] !== undefined) {
                    v = params['@min-' + k];
                    if (v !== undefined) {
                        v = parseInt(v, 10);
                        passed = passed && data[k] >= v;
                    }
                    v = params['@max-' + k];
                    if (v !== undefined) {
                        v = parseInt(v, 10);
                        passed = passed && data[k] <= v;
                    }
                }
            }
        );
        if (data.track !== undefined && params['@track'] !== undefined) {
            passed = passed && (data.track === parseInt(params['@track'], 10));
            // console.log(data.track === parseInt(params['@track'], 10));
        }
        return passed;
    }
};
