const { NlpManager } = require('node-nlp');
const path = require('path');
const fs = require('fs');

class LocalNLP {
    constructor() {
        this.manager = new NlpManager({ languages: ['ar'], forceNER: true });
        this.isLoaded = false;
        this.modelPath = path.join(__dirname, 'model.nlp');
    }

    async init() {
        if (fs.existsSync(this.modelPath)) {
            this.manager.load(this.modelPath);
            this.isLoaded = true;
            console.log('NLP Model loaded successfully.');
        } else {
            console.warn('NLP Model not found. Training a new one...');
            const { trainNLP } = require('./nlp-trainer.cjs');
            await trainNLP();
            this.manager.load(this.modelPath);
            this.isLoaded = true;
        }
    }

    async processMessage(message) {
        if (!this.isLoaded) {
            await this.init();
        }
        
        const response = await this.manager.process('ar', message);
        return {
            intent: response.intent,
            score: response.score,
            entities: response.entities,
            answer: response.answer
        };
    }
}

const nlpEngine = new LocalNLP();

module.exports = { nlpEngine };
