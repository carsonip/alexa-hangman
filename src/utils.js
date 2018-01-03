function ssmlEscape(speech) {
    speech = speech.replace(/&/g, ' and ');
    speech = speech.replace(/</g, '');
    speech = speech.replace(/"/g, '');
    return speech;
}

function displayXmlEscape(content) {
    content = content.replace(/&/g, '&amp;');
    content = content.replace(/"/g, '&quot;');
    content = content.replace(/'/g, '&apos;');
    content = content.replace(/</g, '&lt;');
    content = content.replace(/>/g, '&gt;');
    content = content.replace(/\\/g, '\\\\');
    return content;
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
exports.displayXmlEscape = displayXmlEscape;
exports.objToArr = objToArr;
exports.randomItem = randomItem;
