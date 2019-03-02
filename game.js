function swapElements(obj1, obj2) {
    var parent2 = obj2.parentNode;
    var next2 = obj2.nextSibling;

    if (next2 === obj1) {
        parent2.insertBefore(obj1, obj2);
    } else {
        obj1.parentNode.insertBefore(obj2, obj1);

        if (next2) {
            parent2.insertBefore(obj1, next2);
        } else {
            parent2.appendChild(obj1);
        }
    }
}

(function() {
    var timeouts = [];
    var messageName = "zero-timeout-message";

    function setZeroTimeout(fn) {
        timeouts.push(fn);
        window.postMessage(messageName, "*");
    }

    function handleMessage(event) {
        if (event.source == window && event.data == messageName) {
            event.stopPropagation();
            if (timeouts.length > 0) {
                var fn = timeouts.shift();
                fn();
            }
        }
    }

    window.addEventListener("message", handleMessage, true);

    window.setZeroTimeout = setZeroTimeout;
})();

var cStatLine = "#EA526F";
var cInput = "#EAD352";
var cHidden = "#A8EA52";
var cOutput = "#EA526F";
var cPosW = "#A8EA52";
var cNegW = "#EA526F";

var NE;
var GAME;
var STATS;
var FPS = 60;
var statsFPS = 30;
var maxScore = 0;

var images = {};

var setSpeed = function(speed) {
    FPS = speed;
}


var bumpSpeed = function(amount) {
    var newFPS = (FPS == "max") ? 1020 + amount : FPS + amount;
    if (newFPS < 0) newFPS = 0;
    else if (newFPS >= 1020) newFPS = "max";
    
    FPS = newFPS;
}

var loadImages = function(urls, callback) {
    var waiting = 0;
    var imgs = {};
    for (var i in urls) {
        waiting++;
        imgs[i] = new Image();
        imgs[i].onload = function() {
            waiting--;
            if (waiting <= 0) {
                callback(imgs);
            }
        }
        imgs[i].src = urls[i];
    }
}

var Bird = function(json) { //TODO: add random colors?
    this.x = 80;
    this.y = 250;
    this.width = 40;
    this.height = 30;

    this.alive = true;
    this.gravity = 0.3;
    this.velocity = 0;
    this.force = -6;

    this.init(json);
}

Bird.prototype.init = function(json) {
    for (var i in json) {
        this[i] = json[i];
    }
}

Bird.prototype.flap = function() {
    this.velocity = this.force;
}

Bird.prototype.update = function() {
    this.velocity += this.gravity;
    this.y += this.velocity
}

Bird.prototype.isDead = function(height, pipes) {
    if (this.y >= height || this.y + this.height <= 0) {
        return true;
    } else {
        for (var i in pipes) {
            if (this.x < pipes[i].x + pipes[i].width &&
                this.x + this.width > pipes[i].x &&
                this.y < pipes[i].y + pipes[i].height &&
                this.y + this.height > pipes[i].y
            ) {
                return true;
            }
        }
    }
    return false;
}

var Pipe = function(json) {
    this.x = 500;
    this.y = 0;
    this.width = 50;
    this.height = 40;
    this.speed = 3;

    this.init(json);
}

Pipe.prototype.init = function(json) {
    for (var i in json) {
        this[i] = json[i];
    }
}

Pipe.prototype.update = function() {
    this.x -= this.speed;
}

Pipe.prototype.isOffscreen = function() {
    return (this.x + this.width < 0);
}

var Game = function() {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d");
	
    /*this.vCanvas = document.getElementById("bigVisual");
    this.vCtx = this.vCanvas.getContext("2d");

    this.tCanvas = document.getElementById("smallVisual");
    this.tCtx = this.tCanvas.getContext("2d");*/

    //swapElements(this.sZoomedVisCont, this.lZoomedVisCont);

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.pipes = [];
    this.birds = [];
    this.score = 0;
    this.spawnInterval = 90;
    this.interval = 0;
    this.generation = [];
    this.aliveCount = 0;
    this.generationID = 0;
    this.bgSpeed = 0.5;
    this.bgX = 0;
    this.bestScore = 0;

    this.scoreLimit = 0;

    this.bestNet; //TODO: this is currently not the best net
    this.netTemplate;
    this.netNeedsRecalculation = true;
}

Game.prototype.isEnd = function() { //TODO: limit score?
    /*for (var i in this.birds) {
        if (this.birds[i].alive) {
            return false;
        }
    }*/
    return false;
}

Game.prototype.start = function() {
    this.interval = 0;
    this.score = 0;
    this.pipes = [];
    this.birds = [];

    this.generation = NE.nextGeneration();
    for (var i in this.generation) {
        this.birds.push(new Bird());
    }

    this.generationID++;
    this.aliveCount = this.birds.length;

    STATS.bestNetUpdated = false;
    STATS.updateNewGeneration();
}

Game.prototype.restart = function(manual) {
    if (manual || manual == undefined) {
        for(var i in this.birds) {
            if(this.birds[i].alive) {
                NE.networkScore(this.generation[i], this.scoreLimit);
            }
        }
    }

    this.lastBestScore = this.bestScore;
    STATS.history.push({bestScore: this.score});
    if (STATS.history.length > STATS.historyLength) {
        STATS.history.splice(0, STATS.history.length - STATS.historyLength);
    }
    this.start();
}

Game.prototype.update = function() {
    if (FPS != 0) {
        this.bgX += this.bgSpeed;

        var nextHole = 0;

        if(this.birds.length > 0) {
            for(var i = 0; i < this.pipes.length; i+=2){
                if(this.pipes[i].x + this.pipes[i].width > this.birds[0].x){
                    nextHole = this.pipes[i].height / this.height;
                    break;
                }
            }
        }

        for(var i in this.birds) {
            if(this.birds[i].alive) {

                var inputs = [
                this.birds[i].y / this.height,
                nextHole
                ];

                var res = this.generation[i].compute(inputs);
                if(res > 0.5){
                    this.birds[i].flap();
                }

                this.birds[i].update();
                if(this.birds[i].isDead(this.height, this.pipes)){
                    //this.birds[i].alive = false;
                    //this.aliveCount--;
                    NE.networkScore(this.generation[i], this.score);
                    //if(this.isEnd()){
                        this.restart(false);
                    //} else if (this.generation[i] === STATS.bestNet) {
                    //    STATS.bestNetUpdated = false;
                    //}
                }
            }
        }

        for (var i = 0; i < this.pipes.length; i++) {
            this.pipes[i].update();
            if (this.pipes[i].isOffscreen()) {
                this.pipes.splice(i, 1);
                i--;
            }
        }

        if(this.interval == 0){
            var deltaBoard = 50; 
            var pipeHole = 120;
            var holePosition = Math.round(Math.random() * (this.height - deltaBoard * 2 - pipeHole)) +  deltaBoard;
            //var holePosition = Math.round(Math.random() * this.height);
            //var holePosition = this.height;
            this.pipes.push(new Pipe({x:this.width, y:0, height:holePosition}));
            this.pipes.push(new Pipe({x:this.width, y:holePosition+pipeHole, height:this.height}));
        }

        this.interval++;
        if(this.interval == this.spawnInterval){
            this.interval = 0;
        }

        this.score++;

        if (this.scoreLimit != 0 && this.score > this.scoreLimit) this.restart(true);

        if (this.score >= this.bestScore) {
            this.bestScore = this.score;

            var bestIndex = (NE.options.scoreSort == 1) ? NE.options.population-1 : 0;
            bestIndex = NE.options.population-1;

            if (!STATS.bestNetUpdated) {
                STATS.setBestNet(this.getCurrentBestNet());
            }
        }
    }

    if (FPS == "max") {
        setZeroTimeout(() => {
            this.update();
        });
    } else {
        setTimeout(() => {
            this.update();
        }, 1000/FPS);
    }
}

Game.prototype.getCurrentBestNet = function() {
    for(var i in this.birds) {
        if(this.birds[i].alive) {
            return this.generation[i];
        }
    }
}

Game.prototype.display = function() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    for (var i = 0; i < Math.ceil(this.width / images.bg.width) + 1; i++) {
        this.ctx.drawImage(images.bg, 
                           i * images.bg.width - 
                           Math.floor(this.bgX 
                           % images.bg.width),
                           0);

    }

    for (var i in this.pipes) {
        if (i % 2 == 0) {
            this.ctx.drawImage(images.pipeTop, 
                               this.pipes[i].x, 
                               this.pipes[i].y + this.pipes[i].height - images.pipeTop.height,
                               this.pipes[i].width,
                               images.pipeTop.height);
        } else {
            this.ctx.drawImage(images.pipeBot, 
                               this.pipes[i].x, 
                               this.pipes[i].y, 
                               this.pipes[i].width, 
                               this.pipes[i].height);
        }
    }

    for (var i in this.birds) {
        if (this.birds[i].alive) { //TODO: add grey(dead) birds lol
            this.ctx.save();
            this.ctx.translate(this.birds[i].x + this.birds[i].width/2,
                               this.birds[i].y  + this.birds[i].height/2);
            this.ctx.rotate(Math.PI/2 * this.birds[i].velocity/20);
            this.ctx.drawImage(images.bird,
                               -this.birds[i].width/2, 
                               -this.birds[i].height/2, 
                               this.birds[i].width, 
                               this.birds[i].height);
            this.ctx.restore();
        }
    }

    this.ctx.font = "30px 'VT323', monospace";
    var speedText = (FPS == "max") ? "MAX" : ((FPS/60).toFixed(1) + "x");
    this.ctx.fillText(speedText, 10, 25);

    requestAnimationFrame(() => {
        this.display();
    });
}

function generateTemplate(nn, width, height, radToGapRatioX, radToGapRatioY, radToLineRatio, minLine) {
    var template = {};

    //template.xToYRatio = xToYRatio; Use this for safe checking later? when scaling if I even add it

    var maxX = nn.layers.length;
    var maxY = 0;

    for (var i = 0; i < nn.layers.length; i++) {
        maxY = Math.max(maxY, nn.layers[i].neurons.length);
    }

    var targetGapX = width / (2*radToGapRatioX*maxX + maxX+1);
    var targetGapY = height / (2*radToGapRatioY*maxY + maxY+1);

    var realGapX;
    var realGapY;

    if (targetGapX*radToGapRatioX < targetGapY*radToGapRatioY) {
        template.radius = targetGapX * radToGapRatioX;
        realGapX = targetGapX;
        realGapY = (height - maxY*template.radius*2) / (maxY+1);
    } else {
        template.radius = targetGapY * radToGapRatioY;
        realGapX = (width - maxX*template.radius*2) / (maxX+1);
        realGapY = targetGapY;
    }

    template.lineWidth = template.radius / radToLineRatio;
    template.minLine = minLine;

    var nodePositions = [];

    var xOffset = (width - 
                  (maxX * template.radius*2 + 
                  (maxX+1) * realGapX)) / 2 + 
                  template.radius + 
                  realGapX;
    for (var i = 0; i < nn.layers.length; i++) {
        var yOffset = (height - 
                      (nn.layers[i].neurons.length * template.radius*2 + 
                      (nn.layers[i].neurons.length+1) * realGapY)) / 2 + 
                      template.radius + 
                      realGapY;
        nodePositions[i] = new Array();
        for (var j = 0; j < nn.layers[i].neurons.length; j++) {
            nodePositions[i][j] = {x: xOffset + i * (template.radius*2 + realGapX), 
                                  y: yOffset + j * (template.radius*2 + realGapY)};
        }
    }

    template.nodePositions = nodePositions;

    return template;
}

function drawNetVisual(canvas, nn, template) {
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (var i = 1; i < template.nodePositions.length; i++) {
        for (var j = 0; j < template.nodePositions[i].length; j++) {
            for (var w = 0; w < template.nodePositions[i-1].length; w++) {
                ctx.beginPath();
                ctx.lineWidth = Math.abs(nn.layers[i].neurons[j].weights[w]) * (template.lineWidth-template.minLine) + template.minLine;
                ctx.strokeStyle = (nn.layers[i].neurons[j].weights[w] > 0) ? cPosW : cNegW;
                ctx.moveTo(template.nodePositions[i-1][w].x, template.nodePositions[i-1][w].y);
                ctx.lineTo(template.nodePositions[i][j].x, template.nodePositions[i][j].y);
                ctx.stroke();
            }
        }
    }

    for (var i = 0; i < template.nodePositions.length; i++) {
        for (var j = 0; j < template.nodePositions[i].length; j++) {
            ctx.beginPath();
            ctx.lineWidth = 0.8;
            ctx.strokeStyle = "black";
            ctx.arc(template.nodePositions[i][j].x, template.nodePositions[i][j].y, template.radius, 0, 2*Math.PI);
            switch(i) {
                case 0:
                    ctx.fillStyle = cInput;
                    break;
                case (template.nodePositions.length-1):
                    ctx.fillStyle = cOutput;
                    break;
                default:
                    ctx.fillStyle = cHidden;
                    break;
            }
            ctx.fill();
            ctx.stroke();
        }
    }
}

function drawTableVisual(canvas, nn, resolution) {
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var tableSize = Math.min(canvas.width, canvas.height);
    var tableStep = tableSize/resolution;

    for (var y = 0; y < resolution; y++) {
        for (var x = 0; x < resolution; x++) {
            var answer = nn.compute([(y+0.5) / resolution, (resolution-x-0.5)/resolution]);
            //ctx.fillStyle = "rgb(" + Math.round(255*answer) + "," + Math.round(255*answer) + "," + Math.round(255*answer) + ")";
            ctx.fillStyle = (answer > 0.5) ? "#fff" : "#000";
            ctx.fillRect(tableStep*x, tableStep*y, tableStep, tableStep);
        }
    }
}

var Stats = function() {
    this.infoDiv = document.getElementById("info");

    this.historyCanvas = document.getElementById("graph");
    this.historyCtx = this.historyCanvas.getContext("2d");

    this.normalVisCanvas = document.getElementById("normalVisual");
    this.singleZoomedVisCanvas = document.getElementById("zoomedVisualSingle");
    this.allZoomedVisCanvases = [];

    this.singleZoomedVisCont = document.getElementById("rightContainerSmall");
    this.allZoomedVisCont = document.getElementById("rightContainerLarge");

    this.hiddenCont = document.getElementById("hidder");

    this.bestNet; //TODO: This is not best net currently!!!?  nn, xToYRatio, radToGapRatioX, radToGapRatioY, radToLineRatio
    this.bestNetUpdated = false;

    this.historyLength = 50;
    this.history = [{bestScore: 0}];

    this.visualRadToGapRatioX = 0.5;
    this.visualRadToGapRatioY = 4;
    this.visualRadToLineRatio = 2;
    this.visualMinLine = 1.5;
    this.normalTemplate;
    this.zoomedSingleTemplate;
    this.zoomedAllTemplate;

    this.tableNormalResolution = 17;
    this.tableZoomedSingleResolution = 64;
    this.tableZoomedAllResolution = 14;

    this.canvasesPerRow = 5;

    this.isZoomedOnNet = false;
    this.isShowingAll = false;
}

Stats.prototype.setBestNet = function(net) {
    this.bestNet = net;
    this.bestNetUpdated = true;
    this.updateNetVisuals();
    this.updateTableVisuals();
}

Stats.prototype.updateNewGeneration = function() {
    this.updateAllZoomed();
}

Stats.prototype.start = function() {
    this.generateZoomedCanvases();
    this.generateTemplates(GAME.generation[0]);
}

Stats.prototype.update = function() {
    this.updateHistory();
    this.updateInfo();

    setTimeout(() => {
        this.update();
    }, 1000/statsFPS);
}

Stats.prototype.updateHistory = function() {
    this.historyCtx.clearRect(0, 0, this.historyCanvas.width, this.historyCanvas.height);
    
    this.historyCtx.lineWidth = 3;
    this.historyCtx.strokeStyle = cStatLine;
    this.historyCtx.beginPath();
    
    var currentBestScore = GAME.score;
    for (var i in this.history) {
        if (this.history[i].bestScore > currentBestScore) currentBestScore = this.history[i].bestScore;
    }

    for (var i = 0; i < this.history.length; i++) {
        this.historyCtx.lineTo(
            (i) / (this.history.length) * this.historyCanvas.width,
            this.historyCanvas.height - this.history[i].bestScore / currentBestScore * this.historyCanvas.height
        );
    } 

    this.historyCtx.lineTo(
        this.historyCanvas.width,
        this.historyCanvas.height - GAME.score / GAME.bestScore * this.historyCanvas.height
    );

    this.historyCtx.stroke();
}

Stats.prototype.generateZoomedCanvases = function() {
    var contWidth;

    this.hiddenCont.style.display = "block";
    contWidth = this.allZoomedVisCont.clientWidth;
    this.hiddenCont.style.display = "none";


    for (var i = 0; i < NE.options.population; i++) {
        this.allZoomedVisCanvases[i] = document.createElement("canvas");
        this.allZoomedVisCanvases[i].width = Math.round((contWidth / this.canvasesPerRow) - 4);
        this.allZoomedVisCanvases[i].height = this.allZoomedVisCanvases[i].width;
        this.allZoomedVisCanvases[i].classList.add("zoomedVisualAll")
        this.allZoomedVisCont.appendChild(this.allZoomedVisCanvases[i]);
    }
}

Stats.prototype.updateInfo = function() {
    this.infoDiv.innerText = "Score\n" + GAME.score + 
                             "\nBest Score\n" + GAME.bestScore + 
                             "\nGeneration\n" + GAME.generationID + 
                             "\nAlive\n" + GAME.aliveCount + "/" + NE.options.population;
}

Stats.prototype.updateAllZoomed = function() {
    if (this.isShowingAll) {
        if (this.isZoomedOnNet) {
            this.updateNetVisuals();
        } else {
            this.updateTableVisuals();
        }
    }
}

Stats.prototype.generateTemplates = function(net) { //TODO: do something if net not given
    if (this.normalVisCanvas) 
        this.normalTemplate = generateTemplate(net,
                                               this.normalVisCanvas.width,
                                               this.normalVisCanvas.height, 
                                               this.visualRadToGapRatioX, 
                                               this.visualRadToGapRatioY, 
                                               this.visualRadToLineRatio,
                                               this.visualMinLine);
    if (this.singleZoomedVisCanvas) 
        this.zoomedSingleTemplate = generateTemplate(net,
                                                     this.singleZoomedVisCanvas.width, 
                                                     this.singleZoomedVisCanvas.height, 
                                                     this.visualRadToGapRatioX, 
                                                     this.visualRadToGapRatioY, 
                                                     this.visualRadToLineRatio,
                                                     this.visualMinLine);
    if (this.allZoomedVisCanvases[0]) 
        this.zoomedAllTemplate = generateTemplate(net,
                                                  this.allZoomedVisCanvases[0].width, 
                                                  this.allZoomedVisCanvases[0].height, 
                                                  this.visualRadToGapRatioX, 
                                                  this.visualRadToGapRatioY, 
                                                  this.visualRadToLineRatio,
                                                  this.visualMinLine);
}

Stats.prototype.updateNetVisuals = function() {
    if (!this.isZoomedOnNet) {
        drawNetVisual(this.normalVisCanvas, this.bestNet, this.normalTemplate);
    } else {
        if (!this.isShowingAll) {
            drawNetVisual(this.singleZoomedVisCanvas, this.bestNet, this.zoomedSingleTemplate);
        } else {
            for (var i = 0; i < this.allZoomedVisCanvases.length; i++) {
                drawNetVisual(this.allZoomedVisCanvases[i], GAME.generation[i], this.zoomedAllTemplate);
            }
        }
    }
}

Stats.prototype.updateTableVisuals = function() {
    if (this.isZoomedOnNet) {
        drawTableVisual(this.normalVisCanvas, this.bestNet, this.tableNormalResolution);
    } else {
        if (!this.isShowingAll) {
           drawTableVisual(this.singleZoomedVisCanvas, this.bestNet, this.tableZoomedSingleResolution); 
        } else {
            for (var i = 0; i < this.allZoomedVisCanvases.length; i++) {
                drawTableVisual(this.allZoomedVisCanvases[i], GAME.generation[i], this.tableZoomedAllResolution); 
            }
        }
    }
}

Stats.prototype.swapVisuals = function() {
    this.isZoomedOnNet = !this.isZoomedOnNet;
    this.updateNetVisuals();
    this.updateTableVisuals();
}

Stats.prototype.toggleShowMode = function() {
    swapElements(this.singleZoomedVisCont, this.allZoomedVisCont);
    this.isShowingAll = !this.isShowingAll;

    if (this.isZoomedOnNet) {
        this.updateNetVisuals();
    } else {
        this.updateTableVisuals();
    }
}

window.onload = function() {
    var sprites = {
        bird:    "./img/bird.png",
        bg:      "./img/background.png",
        pipeTop: "./img/pipe_top.png",
        pipeBot: "./img/pipe_bottom.png"
    }

    var start = function() {
        Math.seedrandom(1);

        NE = new Neuroevolution({
            population: 1,
            network: [2, [8], 1],
        });

        

        GAME = new Game();
        STATS = new Stats();



        GAME.start();
        STATS.start();

        //console.log(NE.generations.generations[0].genomes);

        GAME.update();
        STATS.update();



        GAME.display();
    }

    loadImages(sprites, (imgs) => {
        images = imgs;
        start();
    });
}

document.addEventListener("keydown", (event) => {
    switch(event.keyCode) {
        case 39:
            bumpSpeed(60);
            break;
        case 37:
            bumpSpeed(-60);
            break;
        case 38:
            setSpeed("max");
            break;
        case 40:
            setSpeed(60);
    }
});