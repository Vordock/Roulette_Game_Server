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

let crashColor;

function SetRound() {

    const randomValue = Math.random() * 100; // Gera um número entre 0 e 100

    if (randomValue < COLOR_CHANCE) {
        crashColor = 'blue';  // 45% de chance
    } else if (randomValue < COLOR_CHANCE * 2) {
        crashColor = 'red';   // 45% de chance
    } else {
        crashColor = 'yellow';  // 10% de chance
    }

    if (user.last_color !== '') {
        if (user.last_color === crashColor) {
            
            user.current_balance += crashColor === 'yellow' ? user.current_bet_value * MULT_2 : user.current_bet_value * MULT_1;
            
            IO_SERVER.emit('CASHOUT', { balance: user.current_balance, crashColor: crashColor });
        }

        else {
            IO_SERVER.emit('CRASH', { crashColor: crashColor });
        }
    }
}

IO_SERVER.on('connection', (socket) => {

    socket.on("USER_AUTH", (received, callback) => {

        callback && callback({ status: 1, data: { balance: user.current_balance }, multiplies: [MULT_1,MULT_2], message: 'Player Authenticated!' });
    });

    socket.on("PLACE_BET", (emitData, callback) => {

        console.log('\nAposta recebida:', emitData.amount);

        console.log(`Saldo atual: ${user.balance}`);

        const newBet_id = randomUUID();

        user.bet_id = newBet_id;

        console.log('    NOVO ID DE APOSTA: ', user.bet_id);

        if (user.balance >= +emitData.amount) {
            user.balance -= +emitData.amount;

            console.log('\nNovo saldo total:', user.balance, '\n');

            user.current_bet_value = +emitData.amount;

            user.current_color = emitdata.betColor;

            callback && callback({ status: 1, data: { bet: { bet_id: user.bet_id }, user: { balance: user.balance } }, message: 'Bet Successful!' });

            setTimeout(() => {
                SetRound();
            }, ROULETTE_TIME);

        } else {
            console.log('\nSaldo insuficiente:', user.balance, 'é menor que', emitData.amount, '\n');

            callback && callback({ status: 0, message: 'Player balance is not enough.' });
        }

    });

    socket.on("PLACE_CASHOUT", (emitData, callback) => {

        if (emitData.bet_id === user.bet_id) {

            console.log('user.current_bet_value: ', user.current_bet_value);
            console.log('user.current_multiplier: ', user.current_multiplier);

            // Calcular o cashout
            const cashout = user.current_bet_value * user.current_multiplier;

            // Adicionar o cashout ao saldo do usuário
            user.balance += cashout;

            console.log(user.name, 'fez um saque de:', cashout);

            console.log('\nNovo saldo:', user.balance, '\n');

            callback && callback({ status: 1, data: { bet: { withdraw: cashout }, user: { balance: user.balance } }, message: 'Cashout Successful!' });
        } else {
            callback && callback({ status: 0, data: { bet: { bet_id: user.bet_id }, user: { balance: user.balance } }, message: 'Invalid Cashout, bet ID not found!' });
            console.log('\nbet_id not found!\n');
        }
    });
});

SERVER.listen(PORT, () => {
    console.log('Servidor online na porta: ' + PORT);
});
