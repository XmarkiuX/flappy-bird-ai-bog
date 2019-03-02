var Neuroevolution = function(options) {
    var self = this;

    self.options = {
        activation: function(n) {
            return (1/(1 + Math.exp((-n))));
        },

        randomClamped: function() {
            return (Math.random() * 2 - 1);
        },

        network:[1, [1], 1],        // Perceptron network structure (1 hidden layer).
        population:50,              // Population by generation.
        elitism:0.2,                    // Best networks kepts unchanged for the next generation (rate).
        randomBehaviour:0.2,  // New random networks for the next generation (rate).
        mutationRate:0.1,         // Mutation rate on the weights of synapses.
        mutationRange:0.35,      // Interval of the mutation changes on the synapse weight.
        historic:0,                      // Latest generations saved.
        lowHistoric:false,          // Only save score (not the network).
        scoreSort:-1,                // Sort order (-1 = desc, 1 = asc).
        nbChild:1                     // Number of children by breeding.
    };

    self.set = function(options) {
        for (var i in options) {
            if (options[i] !== undefined) {
                self.options[i] = options[i];
            }
        }
    }

    self.set(options);

    var Neuron = function() {
        this.value = 0;
        this.weights = [];
    }        

    Neuron.prototype.populate = function(n) {
        for (var i = 0; i < n; i++) {
            this.weights.push(self.options.randomClamped());
        }
    }

    var Layer = function(id) {
        this.id = id || 0;
        this.neurons = [];
    }

    Layer.prototype.populate = function(nNeurons, nInputs) {
        for (var i = 0; i < nNeurons; i++) {
            var n = new Neuron();
            n.populate(nInputs);
            this.neurons.push(n);
        }
    }

    var Network = function() {
        this.layers = [];
    }

    Network.prototype.populate = function(nInput, nHidden, nOutput) {
        var index = 0;
        var nPrevNeurons = 0;    
        var layer = new Layer(index);

        layer.populate(nInput, nPrevNeurons);
        nPrevNeurons = nInput;
        this.layers.push(layer);
        index++;

        for (var i in nHidden) {
            var layer = new Layer(index);
            layer.populate(nHidden[i], nPrevNeurons);
            nPrevNeurons = nHidden[i];
            this.layers.push(layer);
            index++;
        }

        var layer = new Layer(index);
        layer.populate(nOutput, nPrevNeurons);
        this.layers.push(layer);
    }

    Network.prototype.getSave = function() {
        var data = {
            neurons: [],
            weights: []
        };

        for (var i in this.layers) {
            data.neurons.push(this.layers[i].neurons.length);
            for (var j in this.layers[i].neurons) {
                for (var w in this.layers[i].neurons[j].weights) {
                    data.weights.push(this.layers[i].neurons[j].weights[w]);
                }
            }
        }

        return data;
    }

    Network.prototype.setSave = function(save) {
        var nPrevNeurons = 0;
        var index = 0;
        var indexWeights = 0;

        this.layers = [];
        for (var i in save.neurons) {
            var layer = new Layer(index);
            layer.populate(save.neurons[i], nPrevNeurons);
            for (var j in layer.neurons) {
                for (var w in layer.neurons[j].weights) {
                    layer.neurons[j].weights[w] = save.weights[indexWeights];
                    indexWeights++;
                }
            }

            nPrevNeurons = save.neurons[i];
            index++;
            this.layers.push(layer);
        }
    }
    
    Network.prototype.compute = function(inputs) {
        for (var i in inputs) {
            if (this.layers[0] && this.layers[0].neurons[i]) {
                this.layers[0].neurons[i].value = inputs[i];    
            }
        }

        var prevLayer = this.layers[0];
        for (var i = 1; i < this.layers.length; i++) {
            for (var j in this.layers[i].neurons) {
                var sum = 0;
                for (var w in prevLayer.neurons) {
                    sum += prevLayer.neurons[w].value * this.layers[i].neurons[j].weights[w];
                }

                this.layers[i].neurons[j].value = self.options.activation(sum); //TODO: add self.options...
            }

            prevLayer = this.layers[i];
        }

        var out = [];
        var lastLayer = this.layers[this.layers.length -1];
        for (var i in lastLayer.neurons) {
            out.push(lastLayer.neurons[i].value);
        }

        return out;
    }

    var Genome = function(score, network) {
        this.score = score || 0;
        this.network = network || null;
    }

    var Generation = function() {
        this.genomes = [];
    }

    Generation.prototype.addGenome = function(genome) {
        for (var i = 0; i < this.genomes.length; i++) {
            if (self.options.scoreSort < 0) {
                if (genome.score > this.genomes[i].score) break;
            } else if (self.options.scoreSort < 0) {
                if (genome.score < this.genomes[i].score) break;
            }
        }
        
        this.genomes.splice(i, 0, genome);
    }

    Generation.prototype.breed = function(g1, g2, nChildren) {
        var data = [];
        for (var n = 0; n < nChildren; n++) {
            var datum = JSON.parse(JSON.stringify(g1));  // Makes copy of g1

            for (var i in g2.network.weights) {
                if (Math.random() < 0.5) { //FIXME this should be a predefined constant "crossover factor"
                    datum.network.weights[i] = g2.network.weights[i];
                }
            }

            for (var i in datum.network.weights) {
                if (Math.random() < self.options.mutationRate) {
                    datum.network.weights[i] = Math.random() * self.options.mutationRange * 2 - self.options.mutationRange;
                }
            }

            data.push(datum);
        }

        return data;
    }

    Generation.prototype.generateNextGeneration = function(){
        var nexts = [];

        for(var i = 0; i < Math.round(self.options.elitism * self.options.population); i++){
            if(nexts.length < self.options.population){
                nexts.push(JSON.parse(JSON.stringify(this.genomes[i].network)));
            }
        }

        for(var i = 0; i < Math.round(self.options.randomBehaviour
                                 * self.options.population); i++){
            var n = JSON.parse(JSON.stringify(this.genomes[0].network));
            for(var k in n.weights){
                n.weights[k] = self.options.randomClamped();
            }
            if(nexts.length < self.options.population){
                nexts.push(n);
            }
        }

        // Make children from best genomes (because they are sorted)

        var other = 0;
        while(true) {
            for(var i = 0; i < other; i++){
                    var childs = this.breed(this.genomes[i], this.genomes[other], (self.options.nbChild > 0 ? self.options.nbChild : 1));
                for(var c in childs){
                    nexts.push(childs[c].network);
                    if(nexts.length >= self.options.population){
                        return nexts;
                    }
                }
            }
            other++;
            if(other >= this.genomes.length - 1){
                other = 0;
            }
        }
    }

    var Generations = function() {
        this.generations = [];
        var currentGeneration = new Generation();
    }

    Generations.prototype.firstGeneration = function(input, hiddens, output){
            // TODO: input, hiddens, output unused.

        var out = [];
        for(var i = 0; i < self.options.population; i++){
                // Generate the Network and save it.
            var nn = new Network();
            nn.populate(self.options.network[0],
                        self.options.network[1],
                                        self.options.network[2]);
            nn.layers[1].neurons[0].weights[0] = -0.7546351851766979;
            nn.layers[1].neurons[0].weights[1] = 0.3047443991716887;

            nn.layers[1].neurons[1].weights[0] = 0.3171210884177901;
            nn.layers[1].neurons[1].weights[1] = 0.20452500485481195;

            nn.layers[1].neurons[2].weights[0] = 0.18443374588320927;
            nn.layers[1].neurons[2].weights[1] = -0.2848008978581403;

            nn.layers[1].neurons[3].weights[0] = -0.034285740775308216;
            nn.layers[1].neurons[3].weights[1] = 0.9185090263462392;

            nn.layers[1].neurons[4].weights[0] = -0.007927554891748956;
            nn.layers[1].neurons[4].weights[1] = 0.21612447810946345;

            nn.layers[1].neurons[5].weights[0] = 0.21646039044969112;
            nn.layers[1].neurons[5].weights[1] = 0.04184208111429871;

            nn.layers[1].neurons[6].weights[0] = 0.6409957823797559;
            nn.layers[1].neurons[6].weights[1] = -0.12770636070027008;

            nn.layers[1].neurons[7].weights[0] = -0.2501569220511296;
            nn.layers[1].neurons[7].weights[1] = -0.3494425592146478;

            //-----------

            nn.layers[2].neurons[0].weights[0] = -0.7523924122146042;

            nn.layers[2].neurons[0].weights[1] = -0.1162359633977994;

            nn.layers[2].neurons[0].weights[2] = 0.6547698354188021;

            nn.layers[2].neurons[0].weights[3] = -0.2623431365196044;

            nn.layers[2].neurons[0].weights[4] = -0.6062007636375144;

            nn.layers[2].neurons[0].weights[5] = 0.3180177704526227;

            nn.layers[2].neurons[0].weights[6] = 0.48035029953887776;

            nn.layers[2].neurons[0].weights[7] = 0.20689357845593792;

            out.push(nn.getSave());
        }

        this.generations.push(new Generation()); //TODO: wut?
        return out;
    }

    Generations.prototype.nextGeneration = function(){
        if(this.generations.length == 0){
            // Need to create first generation.
            return false;
        }

        var gen = this.generations[this.generations.length - 1]
                .generateNextGeneration();
        this.generations.push(new Generation()); //TODO: wut?   
        return gen;
    }

    Generations.prototype.addGenome = function(genome){
            // Can't add to a Generation if there are no Generations.
        if(this.generations.length == 0) return false;

         // FIXME addGenome returns void.
        return this.generations[this.generations.length - 1].addGenome(genome);
    }

    //=====================================================

    self.generations = new Generations();

    /**
     * Reset and create a new Generations object.
     *
     * @return void.
     */
    self.restart = function(){
        self.generations = new Generations();
    }

    /**
     * Create the next generation.
     *
     * @return Neural Network array for next Generation.
     */
    self.nextGeneration = function(){
        var networks = [];

        //if(self.generations.generations.length == 0){
                // If no Generations, create first.
            networks = self.generations.firstGeneration();
        //}else{
                // Otherwise, create next one.
            //networks = self.generations.nextGeneration();
        //}

            // Create Networks from the current Generation.
        var nns = [];
        for(var i in networks){
            var nn = new Network();
            nn.setSave(networks[i]);
            nns.push(nn);
        }

        if(self.options.lowHistoric){
                // Remove old Networks.
            if(self.generations.generations.length >= 2){
                var genomes =
                    self.generations
                        .generations[self.generations.generations.length - 2]
                                .genomes;
                for(var i in genomes){
                    delete genomes[i].network;
                }
            }
        }

        if(self.options.historic != -1){
                // Remove older generations.
            if(self.generations.generations.length > self.options.historic + 1){
                    self.generations.generations.splice(0,
                        self.generations.generations.length - (self.options.historic + 1));
            }
        }

        return nns;
    }

    /**
     * Adds a new Genome with specified Neural Network and score.
     *
     * @param {network} Neural Network.
     * @param {score} Score value.
     * @return void.
     */
    self.networkScore = function(network, score){
        self.generations.addGenome(new Genome(score, network.getSave()));
    }
}