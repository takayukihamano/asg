var _ = require('lodash');

module.exports = {
    checkPattern: function (pattern, index) {
        return pattern[index % pattern.length] === '*';
    }
};
