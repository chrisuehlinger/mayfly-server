const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const http = require('http');
const https = require('https');
const fs = require('fs');
const WebSocket = require('ws');

const routes = require('./routes/index');
const users = require('./routes/user');
const { createWebSocketStream } = require('ws');
const isProd = process.env.NODE_ENV === 'production';

var privateKey  = fs.readFileSync(isProd ? `/etc/letsencrypt/live/show.mayfly.live/privkey.pem` : `${__dirname}/certs/localhost+2-key.pem`, 'utf8');
var certificate = fs.readFileSync(isProd ? `/etc/letsencrypt/live/show.mayfly.live/cert.pem` : `${__dirname}/certs/localhost+2.pem`, 'utf8');

var credentials = {key: privateKey, cert: certificate};

const app = express();

const env = process.env.NODE_ENV || 'development';
app.locals.ENV = env;
app.locals.ENV_DEVELOPMENT = env == 'development';

// view engine setup

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// app.use(favicon(__dirname + '/public/img/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

/// catch 404 and forward to error handler
app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use((err, req, res, next) => {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err,
            title: 'error'
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {},
        title: 'error'
    });
});

app.set('port', process.env.PORT || 3000);


var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

const wss = new WebSocket.Server({ server: httpsServer });

wss.on('connection', (ws) => {
    console.log('CONNECTION');

    //connection is up, let's add a simple simple event
    ws.on('message', (message) => {
        console.log('MESSAGE', typeof message, message);

        //log the received message and send it back to the client
        // console.log('received: %s', message);
        // ws.send(`Hello, you sent -> ${message}`);
        wss.clients.forEach(socket => {
            socket.send(message);
        })
    });

    //send immediatly a feedback to the incoming connection    
    // ws.send('Hi there, I am a WebSocket server');
});

!async function() {
    httpServer.listen(3001)
}()

httpsServer.listen(process.env.PORT || 3000)
module.exports = httpsServer;
