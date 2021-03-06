
var BaseCharacter = function() {
};

BaseCharacter.create = function(options) {
    var charData = GameData.characters[options.id];
    for (var key in charData) {
        if (!options.hasOwnProperty(key) && charData.hasOwnProperty(key)) {
            options[key] = charData[key];
        }
    }
    return new charData.characterConstructor(options);
};

BaseCharacter.State = {
    INITIALIZING: 0,
    APPROACHING: 1,
    RUSHING: 2,
    NORMAL: 3,
    ESCAPING: 4,
    DOING_ACTION: 5,
    DISAPPEARING: 6
};

BaseCharacter.bodySprites = {};

BaseCharacter.legsAnimation = new AnimatedSprite({
        'idle': [{src: 'legs-idle.png', duration: 0}],
        'walking': [
            {src: 'legs-walking1.png'},
            {src: 'legs-walking2.png'},
            {src: 'legs-walking3.png'},
            {src: 'legs-walking4.png'},
            {src: 'legs-walking5.png'}
        ],
},
{
    durationMultiplier: 1000 / 60,
    defaultDuration: 5
});

BaseCharacter.iconAnimation = new AnimatedSprite({
        'escaping': [{src: 'icon-escaping.png', duration: 0}],
        'renovating': [{src: 'icon-renovating.png', duration: 0}],
        'reverse': [{src: 'icon-reverse.png', duration: 0}],
        'music': [{src: 'icon-music.png', duration: 0}],
        'music-playing': [
            {src: 'icon-music-playing1.png'},
            {src: 'icon-music-playing2.png'},
            {src: 'icon-music-playing3.png'},
            {src: 'icon-music-playing2.png'}
        ],
        'wedding': [{src: 'icon-wedding.png', duration: 0}],
        'wedding-playing': [
            {src: 'icon-wedding-playing.png'},
            {src: 'icon-wedding.png'}
        ],
        'alert': [
            {src: 'icon-alert1.png'},
            {src: 'icon-alert2.png'}
        ],
},
{
    durationMultiplier: 1000 / 60,
    defaultDuration: 5
});

BaseCharacter.alertSound = new Audio('customer-alert');
BaseCharacter.fallSound = new Audio('customer-fall');
BaseCharacter.fanfareSound = new Audio('band-fanfare');
BaseCharacter.ghostShriekSound = new Audio('ghost-shriek');
BaseCharacter.magnetizedSound = new Audio('magnetized');

BaseCharacter.loadSprites = function() {
    for (var key in GameData.characters) {
        if (GameData.characters.hasOwnProperty(key)) {
            if (GameData.characters[key].bodyIds) {
                for (var i = 0; i < GameData.characters[key].bodyIds.length; ++i) {
                    var bodyId = GameData.characters[key].bodyIds[i];
                    BaseCharacter.bodySprites[bodyId] = new Sprite('body-' + bodyId + '.png');
                }
            } else {
                BaseCharacter.bodySprites[key] = new Sprite('body-' + key + '.png');
            }
        }
    }
};

BaseCharacter.prototype.initBase = function(options) {
    var defaults = {
        floorNumber: 0, // Floor number rises upwards
        x: 0,
        level: null,
        elevator: null,
        goalFloor: 0,
        id: 'customer',
        width: 2,
        weight: 1,
        maxQueueTime : 10,
        minTip : 1,
        maxTip : 10,
        moveSpeedMultiplier: 1,
        immuneToScary: false,
        scary: false,
        takesSpaceInLine: true,
        numberOfLegs: 1,
        legsSpread: 12,
        spawnWith: null,
        reversingControls: false,
        bodyIds: null
    };
    objectUtil.initWithDefaults(this, defaults, options);
    this.legsSprite = new AnimatedSpriteInstance(BaseCharacter.legsAnimation);
    this.bobbleTime = 0;

    var charData = GameData.characters[this.id];
    var shuffledFloors = arrayUtil.shuffle(this.level.floors);
    for (var i = 0; i < shuffledFloors.length;) {
        if (shuffledFloors[i].floorNumber === this.floorNumber) {
            shuffledFloors.splice(i, 1);
            continue;
        }
        var possible = false;
        for (var b = 0; b < charData.destinations.length; b++) {
            if (charData.destinations[b].id === shuffledFloors[i].id) {
                possible = true;
            }
        }
        if (!possible) {
            shuffledFloors.splice(i, 1);
            continue;
        }
        ++i;
    }
    var minPossibleFloorNumber = shuffledFloors[0].floorNumber;
    var maxPossibleFloorNumber = shuffledFloors[0].floorNumber;
    for (var i = 0; i < shuffledFloors.length; ++i) {
        if (shuffledFloors[i].floorNumber < minPossibleFloorNumber) {
            minPossibleFloorNumber = shuffledFloors[i].floorNumber;
        }
        if (shuffledFloors[i].floorNumber > maxPossibleFloorNumber) {
            maxPossibleFloorNumber = shuffledFloors[i].floorNumber;
        }
    }
    var preferGoingDown = (this.weight / this.width) > 1;
    if (preferGoingDown) {
        if (minPossibleFloorNumber > this.floorNumber) {
            this.goalFloor = minPossibleFloorNumber;
        } else {
            for (var i = 0; i < shuffledFloors.length; ++i) {
                if (shuffledFloors[i].floorNumber <= this.floorNumber + 1) {
                    this.goalFloor = shuffledFloors[i].floorNumber;
                    break;
                }
            }
        }
    } else {
        this.goalFloor = shuffledFloors[0].floorNumber;
    }
    this.queueTime = 0;
    this.facingRight = true;
    this.toggleIconTime = 0;
    this.dy = 0;
    this.movedX = 0; // delta of x on last frame
    this.state = BaseCharacter.State.NORMAL;
    this.stateTime = 0;
    this.alwaysBobble = false;
    this.iconSprite = new AnimatedSpriteInstance(BaseCharacter.iconAnimation);

    var bodyId = this.id;
    if (this.bodyIds !== null) {
        bodyId = arrayUtil.shuffle(this.bodyIds)[0];
    }
    this.bodySprite = BaseCharacter.bodySprites[bodyId];
};

BaseCharacter.prototype.renderIcon = function(ctx) {
    var drewIcon = false;
    
    if (!drewIcon && this.state === BaseCharacter.State.ESCAPING) {
        if (mathUtil.fmod(this.toggleIconTime * 3, 1) > 0.5) {
            this.iconSprite.drawRotated(ctx, 0, 0, 0);
            drewIcon = true;
        }
    }
    if (!drewIcon && (this.floorNumber !== this.goalFloor || this.elevator)) {
        whiteBitmapFont.drawText(ctx, '' + (this.goalFloor + 1), 0, -3);
    }
}

BaseCharacter.prototype.render = function(ctx) {
    ctx.save();
    var drawY = this.level.getFloorFloorY(this.floorNumber);
    ctx.translate(Math.floor(this.x), drawY);
    this.renderBody(ctx);
    ctx.save();
    ctx.translate(0, -28);
    ctx.textAlign = 'center';
    this.renderIcon(ctx);
    ctx.restore();
    ctx.restore();
};

/**
 * ctx has its current transform set centered on the floor at the x center of the character.
 */
BaseCharacter.prototype.renderBody = function(ctx) {
    this.renderLegs(ctx);
    var flip = this.facingRight ? 1 : -1;
    this.bodySprite.drawRotatedNonUniform(ctx, 0, -12 + Math.floor(Math.sin(this.bobbleTime * 15) * 1), 0, flip);
};

BaseCharacter.prototype.renderLegs = function(ctx) {
    var flip = this.facingRight ? 1 : -1;
    if (this.numberOfLegs == 1) {
        this.legsSprite.drawRotatedNonUniform(ctx, 0, -6, 0, flip);
    } else if (this.numberOfLegs == 2) {
        this.legsSprite.drawRotatedNonUniform(ctx, -Math.floor(this.legsSpread * 0.5), -6, 0, flip);
        this.legsSprite.drawRotatedNonUniform(ctx, Math.ceil(this.legsSpread * 0.5), -6, 0, flip);
    }
};

BaseCharacter.coinSprite = new AnimatedSprite({
    'fly': [{src: 'coin1.png'},
            {src: 'coin2.png'},
            {src: 'coin3.png'},
            {src: 'coin2.png'},
            ],
},
{
    durationMultiplier: 1000 / 60,
    defaultDuration: 5
});

BaseCharacter.coinAnimation = new AnimatedSpriteInstance(BaseCharacter.coinSprite);

BaseCharacter.tipParticleAppearance = Particle.spriteAppearance(BaseCharacter.coinAnimation, 1);

BaseCharacter.tipParticleEmitter = new ParticleEmitter({
    appearance: BaseCharacter.tipParticleAppearance,
    size: 1,
    minLifetime: 4,
    maxLifetime: 4,
    minVelocity: 60,
    maxVelocity: 90,
    direction: -90,
    directionSpread: 40,
    sizeFunc: function(t) { return 1; },
    opacityFunc: function(t) { return 1; }
});

BaseCharacter.prototype.spawnTip = function() {
    var tip = this.getTip() * this.level.comboCount;
    for (var i = 0; i < tip; ++i) {
        this.level.particles.addParticle(BaseCharacter.tipParticleEmitter.emitParticle({
            x: this.x,
            y: this.level.getFloorFloorY(this.floorNumber) - 24
        }));
    }
};

BaseCharacter.prototype.getTip = function() {
    var relativeTime = mathUtil.clamp(0, 1, 1 - this.queueTime / this.maxQueueTime);
    var tip = this.minTip + Math.round(relativeTime * (this.maxTip - this.minTip));
    return tip;
};

BaseCharacter.prototype.update = function(deltaTime) {
    this.stateTime += deltaTime;
    this.iconSprite.update(deltaTime);

    var doorThresholdX = this.level.getFloorWidth();
    var oldX = this.x;
    
    // Determine target x
    var targetX = undefined;
    var wantOut = (Math.round(this.floorNumber) === this.goalFloor) || this.state === BaseCharacter.State.ESCAPING;
    if (this.state === BaseCharacter.State.DOING_ACTION || this.state === BaseCharacter.State.DISAPPEARING) {
        targetX = this.x;
    } else if (this.state === BaseCharacter.State.APPROACHING) {
        targetX = this.approachTargetX;
    } else if (wantOut && (!this.elevator || this.elevator.doorOpen)) {
        targetX = -1000;
    } else if (this.elevatorTargetX !== undefined) {
        targetX = this.elevatorTargetX;
    } else if (this.state === BaseCharacter.State.RUSHING && this.level.elevator.hasSpace(this.width)) {
        targetX = doorThresholdX + 5;
    } else if (this.floorTargetX !== undefined) {
        targetX = this.floorTargetX;
    } else {
        targetX = doorThresholdX - (1 - this.width * 0.5) * TILE_WIDTH;
    }
    
    // Determine wall positions
    var wallXRight = 0;
    var wallXLeft = -500;
    if (this.elevator) { // Character is in elevator
        this.floorNumber = this.elevator.floorNumber;
        if (this.elevator.doorVisual > 0 && this.state !== BaseCharacter.State.RUSHING) {
            wallXLeft = doorThresholdX + this.elevator.doorVisual * TILE_WIDTH;
        }
        wallXRight = doorThresholdX + 7 * TILE_WIDTH;
    } else {
        if (this.state === BaseCharacter.State.RUSHING) {
            wallXRight = doorThresholdX + 8 * TILE_WIDTH;
        } else if (this.level.floors[this.floorNumber].doorVisual === 0 &&
            this.level.elevator.hasSpace(this.width))
        {
            wallXRight = doorThresholdX + 7 * TILE_WIDTH;
        } else {
            wallXRight = doorThresholdX - this.level.floors[this.floorNumber].doorVisual * TILE_WIDTH;
        }
    }
    
    // Move the character
    if (this.falling) {
        this.x += this.movedX *= 0.98 + 0.01 * deltaTime;
        if (this.x - this.width * 0.5 > doorThresholdX) {
            this.dy -= deltaTime * 4;
            this.floorNumber += this.dy * deltaTime;
        }
    } else {
        propertyToValue(this, 'x', targetX, this.level.characterMoveSpeed * this.moveSpeedMultiplier * deltaTime);
    }

    // Collide with walls
    if (this.x > wallXRight - this.width * 0.5 * TILE_WIDTH) {
        this.x = wallXRight - this.width * 0.5 * TILE_WIDTH;
    }
    if (this.x < wallXLeft + this.width * 0.5 * TILE_WIDTH) {
        this.x = wallXLeft + this.width * 0.5 * TILE_WIDTH;
    }
    
    // Change status based on when crossing elevator threshold
    if (this.x > doorThresholdX) {
        if (!this.falling && this.elevator === null) {
            if (this.floorNumber > -0.1) {
                this.level.floors[Math.round(this.floorNumber)].removeOccupant(this);
            }
            if (Math.abs(this.level.elevator.floorNumber - this.floorNumber) < 0.1) {
                this.elevator = this.level.elevator;
                this.elevator.occupants.push(this);
            } else {
                this.falling = true;
                BaseCharacter.fallSound.play();
            }
        }
    }
    if (this.x < doorThresholdX && this.elevator !== null) {
        this.elevator.removeOccupant(this);
        this.elevator = null;
        this.floorNumber = Math.round(this.floorNumber);
        if (this.floorNumber === this.goalFloor) {
            this.level.reachedGoal(this);
        }
    }
    
    // Update animation
    this.movedX = this.x - oldX;
    var bobble = this.alwaysBobble;
    if (Math.abs(this.movedX) > this.level.characterMoveSpeed * this.moveSpeedMultiplier * deltaTime * 0.4 + 0.001) {
        if (this.legsSprite.animationKey != 'walking') {
            this.legsSprite.setAnimation('walking');
        }
        this.legsSprite.update(deltaTime);
        bobble = true;
        this.facingRight = (this.x > oldX);
    } else {
        this.legsSprite.setAnimation('idle');
        if (!this.elevator) {
            if (this.queueTime < this.maxQueueTime) {
                this.queueTime += deltaTime;
                
                if ( this.queueTime >= this.maxQueueTime ) {
                    this.queueTime = this.maxQueueTime;
                }
            }
        }
    }
    this.toggleIconTime += deltaTime * 0.25;
    if ( this.toggleIconTime >= 1 ) {
        this.toggleIconTime = 0;
    }
    if (bobble) {
        this.bobbleTime += deltaTime;
    }
    
    // Check if the character has left the level
    if (this.x + this.width * TILE_WIDTH < -3 && wantOut) {
        this.dead = true;
    }
    if (this.floorNumber < -1) {
        this.dead = true;
    }
};


var Character = function(options) {
    this.initBase(options);
};

Character.prototype = new BaseCharacter();


var Horse = function(options) {
    this.initBase(options);
    this.legsSprite = new AnimatedSpriteInstance(Horse.legsAnimation);
};

Horse.prototype = new BaseCharacter();

Horse.legsAnimation = new AnimatedSprite({
        'idle': [{src: 'horselegs-idle.png', duration: 0}],
        'walking': [
            {src: 'horselegs-walking1.png'},
            {src: 'horselegs-walking2.png'},
            {src: 'horselegs-walking3.png'},
            {src: 'horselegs-walking4.png'},
            {src: 'horselegs-walking5.png'}
        ],
},
{
    durationMultiplier: 1000 / 60,
    defaultDuration: 5
});


var Cat = function(options) {
    this.initBase(options);
    this.legsSprite = new AnimatedSpriteInstance(Cat.legsAnimation);
};

Cat.prototype = new BaseCharacter();

Cat.legsAnimation = new AnimatedSprite({
        'idle': [{src: 'catlegs2.png', duration: 0}],
        'walking': [
            {src: 'catlegs1.png'},
            {src: 'catlegs2.png'},
        ],
},
{
    durationMultiplier: 1000 / 60,
    defaultDuration: 5
});

Cat.prototype.renderBody = function(ctx) {
    var flip = this.facingRight ? 1 : -1;
    this.bodySprite.drawRotatedNonUniform(ctx, 1, -4 + Math.floor(Math.sin(this.bobbleTime * 15) * 1), 0, flip);
    this.legsSprite.drawRotatedNonUniform(ctx, -1, -2, 0, flip);
    this.legsSprite.drawRotatedNonUniform(ctx, 3, -2, 0, flip);
};


var BandMember = function(options) {
    this.initBase(options);
    this.hasBand = false;
    this.sinceBand = 0;
    this.band = options.band;
    this.iconSprite.setAnimation(this.band);
    this.bandSize = options.bandSize ? options.bandSize : 2;
};

BandMember.prototype = new BaseCharacter();

BandMember.prototype.renderIcon = function(ctx) {
    if (!this.hasBand || this.state === BaseCharacter.State.DOING_ACTION) {
        this.iconSprite.drawRotated(ctx, 0, 0, 0);
    } else {
        BaseCharacter.prototype.renderIcon.call(this, ctx);
    }
};

BandMember.prototype.update = function(deltaTime) {
    BaseCharacter.prototype.update.call(this, deltaTime);
    if (!this.hasBand) {
        this.goalFloor = Math.round(this.floorNumber + 1) % this.level.floors.length;
        if (this.elevator) {
            var band = this.band;
            var canPlay = function(c) {
                return (c instanceof BandMember) &&
                       c.elevatorTargetX !== undefined &&
                       Math.abs(c.x - c.elevatorTargetX) < 0.1 &&
                       !c.hasBand &&
                       c.band === band;
            };
            var count = arrayUtil.count(this.elevator.occupants, canPlay);
            if (count >= this.bandSize) {
                var commonGoal = Math.floor(Math.random() * this.level.floors.length);
                this.hasBand = true;
                for (var i = 0; i < this.elevator.occupants.length; ++i) {
                    var occupant = this.elevator.occupants[i];
                    if (canPlay(occupant)) {
                        occupant.hasBand = true;
                        occupant.iconSprite.setAnimation(this.band + '-playing');
                        occupant.goalFloor = commonGoal;
                        changeState(occupant, BaseCharacter.State.DOING_ACTION);
                    }
                }
                BaseCharacter.fanfareSound.play();
                this.iconSprite.setAnimation(this.band + '-playing');
                this.goalFloor = commonGoal;
                changeState(this, BaseCharacter.State.DOING_ACTION);
            }
        }
    } else {
        this.sinceBand += deltaTime;
        if (this.sinceBand > Game.parameters.get('bandUnionDuration')) {
            changeState(this, BaseCharacter.State.NORMAL);
        }
    }
};


var Runner = function(options) {
    this.initBase(options);
    this.state = BaseCharacter.State.INITIALIZING;
    this.approachTargetX = Math.floor(12 + Math.random() * 20);
    this.alerting = false;
    this.alertTime = this.level.time - 1;
    this.iconSprite.setAnimation('alert');
};

Runner.prototype = new BaseCharacter();

Runner.runningSprites = {
    'runner': new Sprite('body-runner-running.png'),
    'stretcher': new Sprite('body-stretcher.png')
};

/**
 * ctx has its current transform set centered on the floor at the x center of the character.
 */
Runner.prototype.update = function(deltaTime) {
    BaseCharacter.prototype.update.call(this, deltaTime);
    var doorThresholdX = this.level.getFloorWidth();
    if (this.state === BaseCharacter.State.INITIALIZING) {
        // Cut to front of line conceptually
        this.level.floors[Math.round(this.floorNumber)].removeOccupant(this);
        this.level.floors[Math.round(this.floorNumber)].occupants.splice(0, 0, this);
        changeState(this, BaseCharacter.State.APPROACHING);
        this.moveSpeedMultiplier = 1.0;
    } else if (this.state === BaseCharacter.State.APPROACHING) {
        if (Math.abs(this.x - this.approachTargetX) < 0.1) {
            changeState(this, BaseCharacter.State.DOING_ACTION);
            this.moveSpeedMultiplier = 0.0;
        }
    } else if (this.state === BaseCharacter.State.DOING_ACTION) {
        if (this.level.elevator.hasSpace(this.width)) {
            if (!this.alerting) {
                this.alerting = true;
                if (this.level.time > this.alertTime + 1) {
                    BaseCharacter.alertSound.play();
                }
                this.alertTime = this.level.time;
            }
            if (this.stateTime > 1) {
                changeState(this, BaseCharacter.State.RUSHING);
                this.moveSpeedMultiplier = 0.5;
            }
        } else {
            this.stateTime = 0;
            this.alerting = false;
        }
    } else if (this.state === BaseCharacter.State.RUSHING) {
        if (Math.abs(this.movedX) > 0.01) {
            this.moveSpeedMultiplier += deltaTime * 2.0;
        } else if (!this.falling) {
            this.moveSpeedMultiplier = 0.5;
            changeState(this, BaseCharacter.State.APPROACHING);
            this.alerting = false;
        }
        if ((this.elevator && this.x >= doorThresholdX + 5 + this.width * 6 * 0.5) || this.floorNumber === this.goalFloor) {
            changeState(this, BaseCharacter.State.NORMAL);
            this.moveSpeedMultiplier = 1.5;
            this.alerting = false;
        }
    }
};

Runner.prototype.renderIcon = function(ctx) {
    if (this.alerting) {
        this.iconSprite.drawRotated(ctx, 0, 0, 0);
    } else {
        BaseCharacter.prototype.renderIcon.call(this, ctx);
    }
}

/**
 * ctx has its current transform set centered on the floor at the x center of the character.
 */
Runner.prototype.renderBody = function(ctx) {
    if (this.state === BaseCharacter.State.RUSHING) {
        var flip = this.facingRight ? 1 : -1;
        BaseCharacter.prototype.renderLegs.call(this, ctx);
        Runner.runningSprites[this.id].drawRotatedNonUniform(ctx, 0, -12 + Math.floor(Math.sin(this.bobbleTime * 15) * 1), 0, flip);
    } else {
        BaseCharacter.prototype.renderBody.call(this, ctx);
    }
};


var Ghost = function(options) {
    this.initBase(options);
    this.alwaysBobble = true;
    this.stateTime = 0;
    this.scary = false;
    this.didScareCount = 0;
};

//Ghost.scarySound = new Audio('ghost-shriek');

Ghost.prototype = new BaseCharacter();

Ghost.scaringSprite = new Sprite('body-ghost-scaring.png');
Ghost.disappearTime = 2;
/**
 * ctx has its current transform set centered on the floor at the x center of the character.
 */
Ghost.prototype.renderBody = function(ctx) {
    var flip = this.facingRight ? 1 : -1;
    
    if ( this.state === BaseCharacter.State.DISAPPEARING ) {
        var relativeAlpha = mathUtil.clamp(0, 1, 1 - this.stateTime / Ghost.disappearTime);
        ctx.globalAlpha = relativeAlpha;
    }
    
    if (this.scary) {
        Ghost.scaringSprite.drawRotatedNonUniform(ctx, 0, -12 + Math.floor(Math.sin(this.bobbleTime * 2) * 2), 0, flip);
    } else {
        this.bodySprite.drawRotatedNonUniform(ctx, 0, -12 + Math.floor(Math.sin(this.bobbleTime * 2) * 2), 0, flip);
    }
};

Ghost.prototype.renderIcon = function (ctx) {
    if ( this.state === BaseCharacter.State.DISAPPEARING ) {
        return;
    }
    BaseCharacter.prototype.renderIcon.call(this, ctx);
}

Ghost.prototype.update = function(deltaTime) {
    BaseCharacter.prototype.update.call(this, deltaTime);
    if (this.state === BaseCharacter.State.DISAPPEARING) {
        if (this.stateTime >= Ghost.disappearTime) {
            this.dead = true;
        }
    } else {
        if (this.elevator && this.elevator.doorOpen &&
            Math.round(this.floorNumber) !== this.goalFloor &&
            Math.abs(this.x - this.elevatorTargetX) < 0.05 &&
            this.elevator.hasOccupants(function(occupant) { return !occupant.immuneToScary && Math.abs(occupant.x - occupant.elevatorTargetX) < 0.05; }))
        {
            if (this.state !== BaseCharacter.State.DOING_ACTION) {
                changeState(this, BaseCharacter.State.DOING_ACTION);
                BaseCharacter.ghostShriekSound.play();
            }
            var wasScary = this.scary;
            this.scary = (Math.sin(this.stateTime * 1.5) > 0) && this.elevator;
            if (!wasScary && this.scary) {
                //Ghost.scarySound.play();
            }
        } else {
            if (this.state === BaseCharacter.State.DOING_ACTION && this.stateTime > 1) {
                changeState(this, BaseCharacter.State.NORMAL);
                this.scary = false;
                
                this.didScareCount++;
                
                if ( this.didScareCount >= 3 ) {
                    changeState(this, BaseCharacter.State.DISAPPEARING);
                }
            }
        }
    }
};

var Car = function(options) {
    this.initBase(options);
    this.bodySprite = new AnimatedSpriteInstance(Car.animation);
};

Car.prototype = new BaseCharacter();

Car.animation = new AnimatedSprite({
        'idle': [{src: 'car1.png', duration: 0}],
        'moving': [
            {src: 'car1.png'},
            {src: 'car2.png'}
        ],
},
{
    durationMultiplier: 1000 / 60,
    defaultDuration: 5
});

Car.prototype.renderBody = function(ctx) {
    var flip = this.facingRight ? 1 : -1;
    this.bodySprite.drawRotatedNonUniform(ctx, 0, -9, 0, flip);
};

Car.prototype.update = function(deltaTime) {
    BaseCharacter.prototype.update.call(this, deltaTime);
    if (Math.abs(this.movedX) > 0.1 * deltaTime) {
        if (this.bodySprite.animationKey !== 'moving') {
            this.bodySprite.setAnimation('moving');
        }
        this.bodySprite.update(deltaTime);
    } else {
        if (this.bodySprite.animationKey !== 'idle') {
            this.bodySprite.setAnimation('idle');
        }
    }
};

var Renovator = function(options) {
    this.initBase(options);
    this.startFloor = this.floorNumber;
    this.iconSprite.setAnimation('renovating');
};

Renovator.prototype = new BaseCharacter();

Renovator.prototype.update = function(deltaTime) {
    BaseCharacter.prototype.update.call(this, deltaTime);
    if (Math.round(this.floorNumber) !== this.startFloor) {
        this.goalFloor = Math.round(this.floorNumber);
    }
    if (this.dead && this.x < 0) {
        this.level.floors[Math.round(this.floorNumber)].renovate();
    }
};

Renovator.prototype.renderIcon = function(ctx) {
    this.iconSprite.drawRotated(ctx, 0, 0, 0);
};


var Reverser = function(options) {
    this.initBase(options);
    this.iconSprite.setAnimation('reverse');
};

Reverser.prototype = new BaseCharacter();

Reverser.prototype.update = function(deltaTime) {
    BaseCharacter.prototype.update.call(this, deltaTime);
    if (this.state === BaseCharacter.State.NORMAL) {
        if (this.elevator && Math.abs(this.x - this.elevatorTargetX) < 0.05) {
            if (!this.reversingControls) {
                BaseCharacter.magnetizedSound.play();
            }
            this.reversingControls = true;
        } else {
            this.reversingControls = false;
        }
    }
};

Reverser.prototype.renderIcon = function(ctx) {
    if (this.reversingControls && mathUtil.fmod(this.stateTime, 1) < 0.5) {
        this.iconSprite.drawRotated(ctx, 0, 0, 0);
    } else {
        BaseCharacter.prototype.renderIcon.call(this, ctx);
    }
};
