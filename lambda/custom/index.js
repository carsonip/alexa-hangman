'use strict';
const Alexa = require('alexa-sdk');
const makePlainText = Alexa.utils.TextUtils.makePlainText;
const makeRichText = Alexa.utils.TextUtils.makeRichText;
const ImageUtils = Alexa.utils.ImageUtils;
const utils = require('./utils.js');
const descriptions = require('./description/disaster.json');
const axios = require('axios');
const APP_ID = process.env.APP_ID || '';  // TODO replace with your app ID (OPTIONAL).
const BASE_URL = process.env.BASE_URL;

const states = {
    FINISH_GAME: '_FINISH_GAME',
}

const TITLE = 'Natural Disasters Hangman';
const MAX_BAD_GUESS = 6;
const POSITIVE_TERM = [
    'You\'ve got it! ',
    'That\'s right! ',
    'Hooray! ',
    'Bravo! ',
    'Impressive! ',
];
const NEGATIVE_TERM = [
    'Oops! ',
    'Oh no! ',
    'Nope, ',
    'Sorry, ',
];
const LETTER_PROMPT = [
    'Now say a letter. ',
    'Say a letter. ',
    'What\'s next? ',
    'Guess a letter now. ',
    'Now give me a letter. ',
];
const CATEGORIES = [
    'disaster'
];
var vocabs = {};
for (var i = 0; i < CATEGORIES.length; i++) {
    vocabs[CATEGORIES[i]] = require(`./wordlist/${CATEGORIES[i]}.json`);
}
const NEW_GAME = `Say, start, to begin a new game. `
const KNOW_MORE = `Do you want to know more about this natural disaster? Say no, if you want to start a new game. `;


function renderGuessTmpl(speechOutput, reprompt) {
    if (this.event.context.System.device.supportedInterfaces.Display) {
        const builder = new Alexa.templateBuilders.BodyTemplate2Builder();

        const template = builder.setTitle(TITLE)
            .setTextContent(makeRichText(`Word: ${this.attributes['guessed'].split('').join('&#160;')}<br/>Misses: ${this.attributes['misses'].join(',')}`))
            .setImage(ImageUtils.makeImage(`${BASE_URL}img/hangman/${this.attributes['badGuessCnt']}.png`))
            .build();
    
        this.response.speak(speechOutput)
            .listen(reprompt)
            .renderTemplate(template);
        this.emit(':responseReady');
    } else {
        this.emit(':ask', speechOutput, reprompt);
    }
}

function renderTmpl1(richText, speechOutput, reprompt) {
    if (this.event.context.System.device.supportedInterfaces.Display) {
        const builder = new Alexa.templateBuilders.BodyTemplate1Builder();

        const template = builder.setTitle(TITLE)
            .setTextContent(makeRichText(richText))
            .build();
    
        this.response.speak(speechOutput)
            .listen(reprompt)
            .renderTemplate(template);
        this.emit(':responseReady');
    } else {
        this.emit(':ask', speechOutput, reprompt);
    }
}

function renderWelcome() {
    var text = `To begin the game, simply say, Start.`;
    var speechOutput = `Welcome to ${TITLE}! I'll pick a word, you'll guess it. ${text} `;
        
    if (this.event.context.System.device.supportedInterfaces.Display) {
        const builder = new Alexa.templateBuilders.BodyTemplate6Builder();
    
        const template = builder.setTitle(TITLE)
            .setTextContent(makePlainText(`Welcome to ${TITLE}`), makePlainText(text))
            .build();
    
        this.response.speak(speechOutput)
            .listen(text)
            .renderTemplate(template);
        this.emit(':responseReady');
    } else {
        this.emit(':ask', speechOutput, text);
    }
}

function displayDescription(word, description) {
    let attributionText = "Source: Wikipedia (https://en.wikipedia.org/wiki/Natural_disaster)"
    renderTmpl1.call(
        this,
        `<font size="5">${utils.displayXmlEscape(word)}</font> <br/>${utils.displayXmlEscape(description)}<br/><br/><font size="2">${utils.displayXmlEscape(attributionText)}</font>`,
        `${utils.ssmlEscape(word)}<break strength="strong"/>${utils.ssmlEscape(description)}<break strength="x-strong"/>${NEW_GAME}`,
        NEW_GAME
    );
}

function askForLetter(ssmlContent) {
    ssmlContent = ssmlContent || '';
    var content = utils.randomItem(LETTER_PROMPT);
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
    letter = letter || '';
    letter = letter.toLowerCase();
    letter = letter.charAt(0);

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
        ssmlContent += `${utils.randomItem(NEGATIVE_TERM)} no <say-as interpret-as="spell-out">${letter}</say-as>. `
        this.attributes['badGuessCnt'] += 1;
        this.attributes['misses'].push(letter);
        if (this.attributes['badGuessCnt'] >= MAX_BAD_GUESS) {
            this.handler.state = states.FINISH_GAME;
            this.attributes['finish'] = true;
            ssmlContent += `Sorry! You've been hanged! The word is, ${word}, which is spelt, <say-as interpret-as="spell-out"><prosody rate="x-slow">${word}</prosody></say-as>. ${KNOW_MORE} `;
            renderGuessTmpl.call(this, ssmlContent, NEW_GAME);
            return;
        } else {
            var stepsAway = MAX_BAD_GUESS - this.attributes['badGuessCnt'];
            ssmlContent += `You are ${stepsAway} step${stepsAway===1?'':'s'} away from hanging. `
        }
    } else {
        ssmlContent += `<say-as interpret-as="spell-out">${letter}</say-as>, is at ${positions.length === 1 ? 'position' : 'positions'} ${positions.map(x => x + 1).join(', ')}. `;
    }
    if (this.attributes['guessed'].indexOf('_') === -1) {
        this.handler.state = states.FINISH_GAME;
        this.attributes['finish'] = true;
        ssmlContent += `${utils.randomItem(POSITIVE_TERM)} You've got the word, ${word}, which is spelt, <say-as interpret-as="spell-out"><prosody rate="x-slow">${word}</prosody></say-as>. ${KNOW_MORE} `;
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
    var ssmlContent = `A new word is ready. It consists of ${getLetterCount(word)} letters. Say, progress, to check your progress at any time. `;
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
    }).join('<break strength="strong"/>');
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
    var badGuessCnt = this.attributes['badGuessCnt'];
    var stepsAway = MAX_BAD_GUESS - badGuessCnt;
    var ssmlContent = `The word consists of ${getLetterCount(word)} letters. You've got ${getLetterCount(guessed)} of them. 'Dot' indicates the unknown letters in the word. Your progress is, ${readGuessed(guessed)}<break strength="x-strong"/> You are ${stepsAway} step${stepsAway===1?'':'s'} away from hanging. `;
    askForLetter.call(this, ssmlContent)
}

function knowMore() {
    var word = this.attributes['word'];
    var description = descriptions[word];
    displayDescription.call(this, word, description)
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
        // console.log(`Session ended: ${this.event.request.reason}`);
    },
    'Answer': function () {
        answer.call(this, this.event.request.intent.slots.Letter.value);
    },
};

let finishGameHandlers = Alexa.CreateStateHandler(states.FINISH_GAME, Object.assign({}, handlers, {
    'KnowMore': function () {
        knowMore.call(this);
        this.handler.state = null;
    },
    'AMAZON.YesIntent': function () {
        knowMore.call(this);
        this.handler.state = null;
    },
    'AMAZON.NoIntent': function () {
        newWord.call(this);
        this.handler.state = null;
    },
}));

exports.handler = function (event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    // TODO: i18n
    // To enable string internationalization (i18n) features, set a resources object.
    // alexa.resources = languageStrings;
    alexa.registerHandlers(handlers, finishGameHandlers);
    alexa.execute();
};