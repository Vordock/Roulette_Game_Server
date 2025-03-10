const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { randomUUID } = require("crypto");
const { time } = require("console");

const APP = express();
const SERVER = http.createServer(APP);
const IO_SERVER = new Server(SERVER);
const PORT = 2108;

const ROULETTE_TIME = 3000; // in ms
const MULT_1 = 2;
const MULT_2 = 5;

const COLOR_CHANCE = 45;

APP.use(express.static(path.join(__dirname, "/public")));
APP.use("/favicon.ico", (req, res) => res.status(204).end());
APP.get("/page", (req, res) =>
  res.sendFile(path.join(__dirname, "page/index.html"))
);
APP.get("/game/1", (req, res) =>
  res.sendFile(path.join(__dirname, "game/1/index.html"))
);
APP.get("/game/2", (req, res) =>
  res.sendFile(path.join(__dirname, "game/2/index.html"))
);

let user = {
  name: "Mockado",
  current_balance: "3521.00",
  current_bet_id: "",
  current_bet_value: 0,
  current_color: -1,
  betted: false,
};

const GAME_PHASE = [
  { status: "OFF_ROUND", time: 3000 },
  { status: "BETTING", time: 3000 },
  { status: "ON_ROUND", time: 3000 },
];

let roundColor;

function SetResult() {
  if (user.current_color === roundColor) {
    let numericBalance = parseFloat(user.current_balance);

    let cashoutValue =
      roundColor === 2
        ? user.current_bet_value * MULT_2
        : user.current_bet_value * MULT_1;

    numericBalance += cashoutValue;

    user.current_balance = numericBalance.toFixed(2);

    console.log(
      "Saque realizado:",
      cashoutValue,
      "\nNovo saldo: ",
      user.current_balance,
      "\n"
    );
    IO_SERVER.emit("CASHOUT", {
      balance: user.current_balance,
    });
  }
}

IO_SERVER.on("connection", (socket) => {
  socket.on("USER_AUTH", (received, callback) => {
    callback &&
      callback({
        status: 1,
        balance: user.current_balance,
        message: "Player Authenticated!",
      });

    IO_SERVER.emit("BET_CONFIG", {
      multiplies: [MULT_1, MULT_2],
      maxbet: 500, // Example max bet value
    });

    console.log(
      "\n",
      user.name,
      "se conectou com saldo",
      +user.current_balance,
      "\n"
    );
  });

  socket.on("PLACE_BET", (emitData, callback) => {
    //console.log(emitData);

    let numericBalance = parseFloat(user.current_balance);

    console.log("Aposta recebida:", emitData.amount);

    const newBet_id = randomUUID();

    user.current_bet_id = newBet_id;

    //console.log('    BET ID: ', user.current_bet_id);

    if (numericBalance >= +emitData.amount) {
      numericBalance -= +emitData.amount;

      //console.log('\nNovo saldo total:', numericBalance, '\n');

      user.current_bet_value = +emitData.amount;

      user.current_color = emitData.betColor;

      user.current_balance = numericBalance.toFixed(2);

      console.log("Novo saldo: ", user.current_balance, "\n");

      callback &&
        callback({
          status: 1,
          betid: newBet_id,
          balance: user.current_balance,
          message: "Bet Successful!",
        });

      user.betted = true;
    } else {
      console.log(
        "\nSaldo insuficiente:",
        user.current_balance,
        "é menor que",
        emitData.amount,
        "\n"
      );

      callback &&
        callback({ status: 0, message: "Player balance is not enough." });
    }
  });

  socket.on("PLACE_BET_CANCEL", (emitData, callback) => {
    if (user.current_bet_id === emitData.betid) {
      console.log("Aposta cancelada:", emitData.betid);

      let numericBalance = parseFloat(user.current_balance);

      numericBalance += user.current_bet_value;

      user.current_balance = numericBalance.toFixed(2);

      //console.log("Novo saldo:", user.current_balance, "\n");

      callback &&
        callback({
          status: 1,
          balance: user.current_balance,
          message: "Bet Canceled!",
        });

      user.current_bet_id = "";
      user.current_bet_value = 0;
      user.current_color = -1;
    } else {
      console.log("Aposta não encontrada:", emitData.betid);

      callback &&
        callback({
          status: 0,
          message: "Bet not found!",
        });
    }
  });

  socket.on("HISTORY_PLAYER", (arg, callback) => {
    const HISTORY = generateRandomList(10);

    callback && callback({ data: HISTORY });
  });

  socket.on("disconnect", () => {
    console.log("\nO usuario", user.name, "se desconectou!\n");
  });
});

function sendGlobal(namespace, message) {
  console.log(`Enviando mensagem global => ${namespace}:`, message, "\n");
  IO_SERVER.emit(namespace, { message });
}

function StartBetting() {
  user.betted = false;

  user.current_color = -1;

  //console.log("Iniciando rodada de apostas");
  //current_multiplier = 1;

  sendGlobal("GAME_CYCLE", {
    status: GAME_PHASE[1].status,
    interval: GAME_PHASE[1].time,
  });
  setTimeout(StartOnRound, GAME_PHASE[1].time);
}

function StartOnRound() {
  sendGlobal("GAME_CYCLE", {
    status: GAME_PHASE[2].status,
    interval: GAME_PHASE[2].time,
  });

  roundColor = Math.floor(Math.random() * 3);

  IO_SERVER.emit("CRASH", { roundColor: roundColor });

  console.log("Crash no index:", parseInt(roundColor), "\n");

  setTimeout(StartOffRound, GAME_PHASE[2].time);
  //console.log("Crash em:", parseFloat(crash_multiplier), "\n");
}

function StartOffRound() {
  //console.log("Iniciando rodada OFF");
  sendGlobal("GAME_CYCLE", {
    status: GAME_PHASE[0].status,
    interval: GAME_PHASE[0].time,
  });

  //IO_SERVER.emit("HISTORY", { message: lastsCrashs });

  SetResult();

  setTimeout(StartBetting, GAME_PHASE[0].time);
}

function getRandomDate() {
  const start = new Date(2024, 5, 14, 11, 43, 0); // 14/06/2024 11:43:00
  const end = new Date(2024, 5, 14, 12, 0, 0); // 14/06/2024 12:00:00
  const date = new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
  return date.toISOString().replace("T", " ").split(".")[0]; // Formata para "dd/MM/yyyy HH:mm:ss"
}

function getRandomType() {
  return "win";
}

function getRandomValue(limit) {
  return (1 + Math.random() * (limit + 1)).toFixed(2);
}

function getRandomCrash() {
  return (Math.random() * (2 - 1.01) + 1.01).toFixed(2); // Valores de crash
}

function generateRandomList(numEntries) {
  const myList = [];
  for (let i = 0; i < numEntries; i++) {
    myList.push({
      data: getRandomDate(),
      type: getRandomType(),
      aposta: getRandomValue(100),
      crash: getRandomCrash(),
      cashout: getRandomValue(100),
    });
  }
  return myList;
}

SERVER.listen(PORT, () => {
  console.log("\nServidor online na porta: " + PORT);
  StartOffRound();
});
