const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const APP = express();
const SERVER = http.createServer(APP);
const IO_SERVER = new Server(SERVER);
const PORT = 2108;

APP.use(express.static(path.join(__dirname, '/public')));
APP.use('/favicon.ico', (req, res) => res.status(204).end());
APP.get('/page', (req, res) => res.sendFile(path.join(__dirname, 'page/index.html')));
APP.get('/game/1', (req, res) => res.sendFile(path.join(__dirname, 'game/1/index.html')));
APP.get('/game/1', (req, res) => res.sendFile(path.join(__dirname, 'game/1/index.html')));
