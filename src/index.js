'use strict';
const Alexa = require('alexa-sdk');
const makePlainText = Alexa.utils.TextUtils.makePlainText;
const makeRichText = Alexa.utils.TextUtils.makeRichText;
const ImageUtils = Alexa.utils.ImageUtils;
const utils = require('./utils.js');
const APP_ID = process.env.APP_ID || '';  // TODO replace with your app ID (OPTIONAL).
const BASE_URL = process.env.BASE_URL;

const TITLE = 'Hangman Game';
const MAX_BAD_GUESS = 6;
const POSITIVE_SENTENCE = [
    'You\'ve got it! ',
    'That\'s right! ',
    'Impressive! ',
];
const NEGATIVE_SENTENCE = [
    'Woops! Try again! ',
    'Oh no! Try again! ',
    'That\'s incorrect! Try again! ',
];
const CATEGORIES = [
    'food', 'fruit', 'shopping', 'sports', 'travel'
];
var vocabs = {};
for (var i=0;i<CATEGORIES.length;i++) {
    vocabs[CATEGORIES[i]] = require(`./wordlist/${CATEGORIES[i]}.json`);
}
const NEW_GAME = `Say, start, when you are ready for a new game, or you can pick a category from ${CATEGORIES.join(', ')}. `


function renderTmpl(speechOutput, reprompt) {
    const builder = new Alexa.templateBuilders.BodyTemplate2Builder();

	const template = builder.setTitle(TITLE)
                            .setTextContent(makeRichText(`Word: ${this.attributes['guessed'].split('').join(' ')}<br/>Misses: ${this.attributes['misses'].join(',')}`))
                            .setImage(ImageUtils.makeImage(`${BASE_URL}img/hangman/${this.attributes['badGuessCnt']}.png`))
							.build();

    this.response.speak(speechOutput)
                .listen(reprompt)
				.renderTemplate(template);
    this.emit(':responseReady');
}


function askForLetter(ssmlContent) {
    ssmlContent = ssmlContent || '';
    var content = 'Now say a letter, or you may say, progress, to check your progress. ';
    renderTmpl.call(this, ssmlContent + content, content);
}

function promptNoActiveGame() {
    const builder = new Alexa.templateBuilders.BodyTemplate1Builder();

    const template = builder.setTitle(TITLE)
                            .setTextContent(makePlainText(`There is no game yet. ${NEW_GAME}`))
                            .build();

    this.response.speak(`There is no game yet. ${NEW_GAME}`)
                .listen(NEW_GAME)
                .renderTemplate(template);
    this.emit(':responseReady');
}

function answer(letter) {
    var word = this.attributes['word'];
    if (!word) {
        promptNoActiveGame.call(this);
        return;
    }
    letter = letter.toLowerCase();
    if (this.attributes['guessedLetters'].indexOf(letter) !== -1) {
        askForLetter.call(this, `You've guessed <say-as interpret-as="spell-out">${letter}</say-as> already. Try another letter. `);
        return;
    }
    this.attributes['guessedLetters'].push(letter);
    var positions = [];
    var len = word.length;
    for (var i = 0; i < len; i++) {
        if (letter === word.charAt(i)) {
            positions.push(i);
            this.attributes['guessed'] = this.attributes['guessed'].replaceAt(i, letter);
        }
    }
    var ssmlContent = '';
    if (positions.length === 0) {
        ssmlContent += `Oh no, letter <say-as interpret-as="spell-out">${letter}</say-as> isn't in the word. `
        this.attributes['badGuessCnt'] += 1;
        this.attributes['misses'].push(letter)
        if (this.attributes['badGuessCnt'] >= MAX_BAD_GUESS) {
            cleanup.call(this);
            ssmlContent += `Sorry! you've been hanged! The word is, ${word}, which is spelt, <say-as interpret-as="spell-out">${word}</say-as>. ${NEW_GAME} `;
            renderTmpl.call(this, ssmlContent, NEW_GAME);
            return;
        }
    } else {
        ssmlContent += `Letter <say-as interpret-as="spell-out">${letter}</say-as> is at ${positions.length === 1 ? 'position' : 'positions'} ${positions.map(x => x + 1).join(', ')}. `;
    }
    if (this.attributes['guessed'].indexOf('_') === -1) {
        cleanup.call(this);
        ssmlContent += `Great! You got the word, ${word}, which is spelt, <say-as interpret-as="spell-out">${word}</say-as>. ${NEW_GAME}`;
        renderTmpl.call(this, ssmlContent, NEW_GAME);
        return;
    } else {
        askForLetter.call(this, ssmlContent);
    }
}

function cleanup() {
    this.attributes['word'] = '';
    this.attributes['guessed'] = '';
    this.attributes['guessedLetters'] = [];
    this.attributes['badGuessCnt'] = 0;
    this.attributes['misses'] = []
}

function newWord(category) {
    cleanup.call(this);
    category = category || this.attributes['category'] || utils.randomItem(CATEGORIES);
    this.attributes['category'] = category;
    var word = utils.randomItem(vocabs[category]);
    this.attributes['word'] = word;
    this.attributes['guessed'] = word.replace(/[a-z]/g, '_');
    var ssmlContent = `A new word is ready. It consists of ${word.length} letters. `;
    askForLetter.call(this, ssmlContent)
}

function readGuessed(guessed) {
    return guessed.split('').map(function(letter) {
        if (letter === '_') {
            return 'dot';
        } else if (letter === ' ') {
            return 'space';
        } else {
            return `<say-as interpret-as="spell-out">${letter}</say-as>`;
        }
    }).join(' ');
}

function getLetterCount(word) {
    var cnt = 0;
    for (var i=0;i<word.length;i++) {
        var char = word.charAt(i);
        if (char >= 'a' && char <= 'z') cnt++;
    }
    return cnt;
}

function progress() {
    var word = this.attributes['word'];
    if (!word) {
        promptNoActiveGame.call(this);
        return;
    }
    var guessed = this.attributes['guessed'];
    var ssmlContent = `The word consists of ${getLetterCount(word)} letters. You've got ${getLetterCount(guessed)} of them. 'Dot' indicates the unknown letters in the word. Your progress is, ${readGuessed(guessed)}<break strength="strong"/>`;
    askForLetter.call(this, ssmlContent)
}

var handlers = {
    'LaunchRequest': function () {
        this.emit('AMAZON.HelpIntent');
    },
    'Play': function () {
        newWord.call(this);
    },
    'PickCategory': function () {
        newWord.call(this, this.event.request.intent.slots.Category.value);
    },
    'Progress': function () {
        progress.call(this);
    },
    'AMAZON.HelpIntent': function () {
        var speechOutput = `Welcome to Hangman Game! I'll pick a word, you'll guess it. To begin the game, pick a category from ${CATEGORIES.join(', ')}`;
        var reprompt = `To begin the game, pick a category from ${CATEGORIES.join(', ')}`;
        this.emit(':ask', speechOutput, reprompt);
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', 'Goodbye');
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', 'Goodbye');
    },
    'Unhandled': function () {
        const speechOutput = 'I don\'t understand that. Say, help, for help.'
        this.response.speak(speechOutput).listen(speechOutput);
        this.emit(':responseReady');
    },
    'SessionEndedRequest': function () {
        console.log(`Session ended: ${this.event.request.reason}`);
    },
    'Answer': function () {
        answer.call(this, this.event.request.intent.slots.Letter.value);
    },
};

exports.handler = function (event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    // TODO: i18n
    // To enable string internationalization (i18n) features, set a resources object.
    // alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};