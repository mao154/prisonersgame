/**
 * # Logic code for prisoner Game
 * Copyright(c) 2017 Stefano Balietti
 * MIT Licensed
 *
 * Handles bidding, and responds between two players.
 *
 * http://www.nodegame.org
 */
const ngc = require('nodegame-client');
const stepRules = ngc.stepRules;
const J = ngc.JSUS;

// Here we export the logic function. Receives three parameters:
// - node: the NodeGameClient object.
// - channel: the ServerChannel object in which this logic will be running.
// - gameRoom: the GameRoom object in which this logic will be running.
module.exports = function(treatmentName, settings, stager, setup, gameRoom) {

    let channel = gameRoom.channel;
    let node = gameRoom.node;

    let timers = settings.TIMER;

    /* representation of game history
     {
         player1Id:
         {
             coins: 0,
             choices: ["DEFECT",
                        "COOPERATE" ...]
         },
         player2Id: {
             coins: 0,
             choices: ["COOPERATE",
                        "COOPERATE" ...]
         }
     }*/
    node.game.history = {};

    stager.setDefaultProperty('minPlayers', [
        settings.MIN_PLAYERS
    ]);

    stager.setDefaultProperty('pushClients', true);

    stager.extendStep('respond', {
        cb: function() {
            ++ node.game.round;
            node.on.data('done', function (msg) {
                let id;

                id = msg.from;
                addToHistory(id, msg.data.choice, node.game.history);
            });
        }
    });

    stager.extendStep('results', {
        cb: function() {
            let playerIds = [];
            let p1Id, P2Id;
            let p1Choice, p2Choice;
            let p1Payoff, p2Payoff;

            playerIds = Object.keys(node.game.history);
            p1Id = playerIds[0];
            p2Id = playerIds[1];
            p1Choice = getRecentChoice(p1Id, node.game.history);
            p2Choice = getRecentChoice(p2Id, node.game.history);
            /*
                Payoff Table     Settings Constants
                P1     P2    |   P1                 P2
                DEFECT COOP      BETRAY             COOPERATE_BETRAYED
                COOP   DEFECT    COOPERATE_BETRAYED BETRAY
                DEFECT DEFECT    DEFECT             DEFECT
                COOPER COOPERATE COOPERATE          COOPERATE
            */
            if ('DEFECT' === p1Choice && 'COOPERATE' === p2Choice) {
                p1Payoff = settings.BETRAY;
                p2Payoff = settings.COOPERATE_BETRAYED;
            }
            else if ('COOPERATE' === p1Choice && 'DEFECT' === p2Choice) {
                p2Payoff = settings.BETRAY;
                p1Payoff = settings.COOPERATE_BETRAYED;
            }
            else if ('DEFECT' === p1Choice && 'DEFECT' === p2Choice) {
                p1Payoff = settings.DEFECT;
                p2Payoff = settings.DEFECT;
            }
            else {
                p1Payoff = settings.COOPERATE;
                p2Payoff = settings.COOPERATE;
            }
            addCoins(p1Id, p1Payoff, node.game.history);
            addCoins(p2Id, p2Payoff, node.game.history);
            sendToClient(p1Id, p1Payoff, p2Payoff, p2Choice);
            sendToClient(p2Id, p2Payoff, p1Payoff, p1Choice);
            updateWin(p1Id, p1Payoff);
            updateWin(p2Id, p2Payoff);
        }
    });

    stager.extendStep('endgame', {
        minPlayers: undefined,
        steprule: stepRules.SOLO,
        cb: function() {
            gameRoom.computeBonus({
                say: true,
                dump: true,
                print: true
            });
        }
    });

    // sends game data to player clients
    function sendToClient(id, myPayoff, otherPayoff, choice) {
        node.say("results", id, {
            myEarning: myPayoff,
            otherEarning: otherPayoff,
            myBank: getBankTotal(id, node.game.history),
            otherChoice: choice
        });
        //node.say("myEarning", id, myPayoff);
        //node.say("otherEarning", id, otherPayoff);
        //node.say("myBank", id, getBankTotal(id, node.game.history));
    }

    function updateWin(id, win) {
        let client;
        client = channel.registry.getClient(id);
        client.win = client.win ? client.win + win : win;
    }

    // retrieves the player's total number of coins
    function getBankTotal(id, history) {
        return history[id].coins;
    }

    // appends the player's choice to history data
    function addToHistory(id, choice, history) {
        if (!history[id]) {
            history[id] = {};
            history[id].coins = 0;
            history[id].choices = [];
        }
        history[id].choices.push(choice);
        console.log(id + choice);
    }

    // retrieves the player's most recent choice
    function getRecentChoice(id, history) {
        return history[id].choices[history[id].choices.length - 1];
    }

    // increases player's coins by received Payoff
    function addCoins(id, payOff, history) {
        history[id].coins += payOff;
    }

};
