'use strict';
const Alexa = require('alexa-sdk');
const makePlainText = Alexa.utils.TextUtils.makePlainText;
const makeRichText = Alexa.utils.TextUtils.makeRichText;
const ImageUtils = Alexa.utils.ImageUtils;
const utils = require('./utils.js');
const axios = require('axios');
const APP_ID = process.env.APP_ID || '';  // TODO replace with your app ID (OPTIONAL).
const BASE_URL = process.env.BASE_URL;
const WORDNIK_API_KEY = process.env.WORDNIK_API_KEY;

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
for (var i = 0; i < CATEGORIES.length; i++) {
    vocabs[CATEGORIES[i]] = require(`./wordlist/${CATEGORIES[i]}.json`);
}
const NEW_GAME = `Say, start, to begin a new game, or you can pick a category from ${CATEGORIES.join(', ')}. `
const DICTIONARY = `Say, dictionary, to see the definition of this word. `;


function renderGuessTmpl(speechOutput, reprompt) {
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

function renderTmpl1(richText, speechOutput, reprompt) {
    const builder = new Alexa.templateBuilders.BodyTemplate1Builder();

    const template = builder.setTitle(TITLE)
        .setTextContent(makeRichText(richText))
        .build();

    this.response.speak(speechOutput)
        .listen(reprompt)
        .renderTemplate(template);
    this.emit(':responseReady');
}

function renderWelcome() {
    var text = `To begin the game, pick a category from ${CATEGORIES.join(', ')}, or simply say, Start.`;
    const builder = new Alexa.templateBuilders.BodyTemplate6Builder();

    const template = builder.setTitle(TITLE)
        .setTextContent(makePlainText('Welcome to Hangman Game'), makePlainText(text))
        .build();

    this.response.speak(`Welcome to Hangman Game! I'll pick a word, you'll guess it. ${text} `)
        .listen(text)
        .renderTemplate(template);
    this.emit(':responseReady');
}

function displayDictResult(word, partOfSpeech, definition, attributionText) {
    if (definition) {
        renderTmpl1.call(
            this,
            `<font size="5">${utils.displayXmlEscape(word)}</font> <font size="2">(${utils.displayXmlEscape(partOfSpeech)})</font><br/>${utils.displayXmlEscape(definition)}<br/><br/><font size="2">${utils.displayXmlEscape(attributionText)}</font>`,
            `${utils.ssmlEscape(word)}<break strength="strong"/>${utils.ssmlEscape(partOfSpeech)}<break strength="strong"/>${utils.ssmlEscape(definition)}<break strength="strong"/>${NEW_GAME}`,
            NEW_GAME
        );
    } else {
        renderTmpl1.call(this, `Definition of <b>${word}</b> not found.`, `Definition of, ${word}, not found. ${NEW_GAME}`, NEW_GAME);
    }
}

function askForLetter(ssmlContent) {
    ssmlContent = ssmlContent || '';
    var content = 'Now say a letter, or you may say, progress, to check your progress. ';
    renderGuessTmpl.call(this, ssmlContent + content, content);
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

function existActiveGame() {
    var word = this.attributes['word'];
    var finish = this.attributes['finish'];
    return !!word && !finish;
}

function answer(letter) {
    var word = this.attributes['word'];
    if (!existActiveGame.call(this)) {
        promptNoActiveGame.call(this);
        return;
    }
    letter = letter.toLowerCase();
    if (this.attributes['guessedLetters'].indexOf(letter) !== -1) {
        askForLetter.call(this, `You've guessed, <say-as interpret-as="spell-out">${letter}</say-as>, already. Try another letter. `);
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
        ssmlContent += `Oh no, letter, <say-as interpret-as="spell-out">${letter}</say-as>, isn't in the word. `
        this.attributes['badGuessCnt'] += 1;
        this.attributes['misses'].push(letter);
        if (this.attributes['badGuessCnt'] >= MAX_BAD_GUESS) {
            this.attributes['finish'] = true;
            ssmlContent += `Sorry! you've been hanged! The word is, ${word}, which is spelt, <say-as interpret-as="spell-out"><prosody rate="x-slow">${word}</prosody></say-as>. ${DICTIONARY} ${NEW_GAME} `;
            renderGuessTmpl.call(this, ssmlContent, NEW_GAME);
            return;
        }
    } else {
        ssmlContent += `Letter, <say-as interpret-as="spell-out">${letter}</say-as>, is at ${positions.length === 1 ? 'position' : 'positions'} ${positions.map(x => x + 1).join(', ')}. `;
    }
    if (this.attributes['guessed'].indexOf('_') === -1) {
        this.attributes['finish'] = true;
        ssmlContent += `Great! You got the word, ${word}, which is spelt, <say-as interpret-as="spell-out"><prosody rate="x-slow">${word}</prosody></say-as>. ${DICTIONARY} ${NEW_GAME}`;
        renderGuessTmpl.call(this, ssmlContent, NEW_GAME);
        return;
    } else {
        askForLetter.call(this, ssmlContent);
    }
}

function cleanup() {
    this.attributes['finish'] = false;
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
    return guessed.split('').map(function (letter) {
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
    for (var i = 0; i < word.length; i++) {
        var char = word.charAt(i);
        if (char >= 'a' && char <= 'z') cnt++;
    }
    return cnt;
}

function progress() {
    var word = this.attributes['word'];
    if (!existActiveGame.call(this)) {
        promptNoActiveGame.call(this);
        return;
    }
    var guessed = this.attributes['guessed'];
    var ssmlContent = `The word consists of ${getLetterCount(word)} letters. You've got ${getLetterCount(guessed)} of them. 'Dot' indicates the unknown letters in the word. Your progress is, ${readGuessed(guessed)}<break strength="strong"/>`;
    askForLetter.call(this, ssmlContent)
}

function dictionary() {
    var that = this;
    var word = this.attributes['word'];
    var finish = this.attributes['finish'];
    if (!word) {
        promptNoActiveGame.call(this);
        return;
    } else if (word && !finish) {
        askForLetter.call(this, `You're not allowed to check the dictionary now.`);
        return;
    }
    var url = `http://api.wordnik.com:80/v4/word.json/${word}/definitions?limit=1&includeRelated=false&useCanonical=false&sourceDictionaries=wiktionary&includeTags=false&api_key=${WORDNIK_API_KEY}`;
    axios.get(url)
        .then(function (response) {
            if (!response.data || response.data.length === 0) {
                displayDictResult.call(that, word, null, null, null);
            } else {
                var obj = response.data[0];
                displayDictResult.call(that, obj.word, obj.partOfSpeech, obj.text, obj.attributionText);
            }
        })
        .catch(function (error) {
            console.log(error);
        });
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
    'Dictionary': function () {
        dictionary.call(this);
    },
    'AMAZON.HelpIntent': function () {
        renderWelcome.call(this);
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