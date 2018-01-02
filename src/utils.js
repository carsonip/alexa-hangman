function ssmlEscape(speech) {
    speech = speech.replace(/&/g, ' and ');
    speech = speech.replace(/</g, '');
    speech = speech.replace(/"/g, '');
    return speech;
}

function objToArr(obj) {
    return Object.keys(obj).map((k) => obj[k]);
}

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

Object.defineProperty(Array.prototype, 'chunk', {
    value: function (chunkSize) {
        var R = [];
        for (var i = 0; i < this.length; i += chunkSize)
            R.push(this.slice(i, i + chunkSize));
        return R;
    }
});

String.prototype.replaceAt=function(index, replacement) {
    return this.substr(0, index) + replacement+ this.substr(index + replacement.length);
}

exports.ssmlEscape = ssmlEscape;
exports.objToArr = objToArr;
exports.randomItem = randomItem;
