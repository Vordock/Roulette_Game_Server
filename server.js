const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const APP = express();
const SERVER = http.createServer(APP);
const IO_SERVER = new Server(SERVER);
const PORT = 2108;

const ROULETTE_TIME = 3000; // in ms
const MULT_1 = 2;
const MULT_2 = 10;

const COLOR_CHANCE = 45;

APP.use(express.static(path.join(__dirname, '/public')));
APP.use('/favicon.ico', (req, res) => res.status(204).end());
APP.get('/page', (req, res) => res.sendFile(path.join(__dirname, 'page/index.html')));
APP.get('/game/1', (req, res) => res.sendFile(path.join(__dirname, 'game/1/index.html')));
APP.get('/game/2', (req, res) => res.sendFile(path.join(__dirname, 'game/2/index.html')));

let user = {
    name: 'Mockado',
    current_balance: '3521.00',
    current_bet_id: '',
    current_bet_value: 0,
    current_color: ''
};

let roundColor;

function SetRound() {

    const randomValue = Math.random() * 100; // Gera um número entre 0 e 100

    if (randomValue < COLOR_CHANCE) {
        roundColor = 'blue';    // 45% de chance

    } else if (randomValue < COLOR_CHANCE * 2) {
        roundColor = 'red';     // 45% de chance

    } else {
        roundColor = 'yellow';  // 10% de chance
    }

    if (user.current_color !== '') {
        if (user.current_color === roundColor) {

            let numericBalance = parseFloat(user.current_balance);

            numericBalance += roundColor === 'yellow' ? user.current_bet_value * MULT_2 : user.current_bet_value * MULT_1;

            user.current_balance = numericBalance.toFixed(2);

            IO_SERVER.emit('CASHOUT', { data: {balance: user.current_balance}, roundColor: roundColor });
 
        }

        else {
            IO_SERVER.emit('CRASH', { roundColor: roundColor });
        }
    }
}

IO_SERVER.on('connection', (socket) => {

    socket.on("USER_AUTH", (received, callback) => {

        callback && callback({
            status: 1,
            data: { balance: user.current_balance },
            multiplies: [MULT_1, MULT_2],
            message: 'Player Authenticated!'
        });
    });

    socket.on("PLACE_BET", (emitData, callback) => {

        console.log(emitData);

        let numericBalance = parseFloat(user.current_balance);

        console.log('\nAposta recebida:', emitData.amount);

        console.log(`Saldo atual: ${user.current_balance}`);

        const newBet_id = randomUUID();

        user.current_bet_id = newBet_id;

        console.log('    NOVO ID DE APOSTA: ', user.current_bet_id);

        if (numericBalance >= +emitData.amount) {

            numericBalance -= +emitData.amount;

            console.log('\nNovo saldo total:', numericBalance, '\n');

            user.current_bet_value = +emitData.amount;

            user.current_color = emitData.betColor;

            callback && callback({
                status: 1, data:
                    { bet: { bet_id: user.current_bet_id }, user: { balance: numericBalance } },
                message: 'Bet Successful!'
            });

            setTimeout(() => {
                SetRound();
            }, ROULETTE_TIME);

            user.current_balance = numericBalance.toFixed(2);
            console.log(user.current_balance);
            

        } else {
            console.log('\nSaldo insuficiente:', user.current_balance, 'é menor que', emitData.amount, '\n');

            callback && callback({ status: 0, message: 'Player balance is not enough.' });
        }

    });
});

SERVER.listen(PORT, () => {
    console.log('\nServidor online na porta: ' + PORT);
});
