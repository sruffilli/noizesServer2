// Port used by the service
const port = 8888;
// FQDN (+ port). Will be used to return a soundlist with full absolute paths
const fqdn = 'http://localhost:' + port;

// Lovely requirements
require('shelljs/global');
var fs = require('fs');
var shellescape = require('shell-escape');
var tmp = require('tmp');

//express + socket.io setup
var express = require('express');
var multer = require('multer');
var app = express();
var webServer = require('http').createServer(app);

// usernames which are currently connected to the chat
var usernames = {};
var numUsers = 0;

/*
 *   Logger setup
 */

var winston = require('winston');
winston.level = 'debug';

function logger(message, options) {
  options = options || {};
  if (typeof options.loglevel === 'undefined') {
      options.loglevel = 'info';
  }

  if (typeof options.socket === 'undefined') {
    options.socket = {};
  }

  winston.log(options.loglevel, new Date().toISOString() + ', ' + options.remoteAddress + ', Users: ' + numUsers+ ', ' + options.socket.id + ', ' + options.socket.username + ', ' +  message);
}

webServer.listen(port, function() {
  logger('Server listening at port ' +  port);
});

/*
 *   Routing path for static assets (Webapp + sounds)
 */

app.use(express.static(__dirname + '/public'));

/*
 *   Websocket
 */

var io = require('socket.io')(webServer);

// A 'sillyname' will automatically be generated for every client connecting to the service
var generateName = require('sillyname');

// Where the sounds are stored, relative to the app
var uploadsPath = __dirname + '/public/assets';
// Where the sounds can be retrieved relative to the public dir
var uploadsWebPath = '/assets'

var soundList = {};

io.on('connection', function(socket) {
  var addedUser = false;
  
  logger('New user joined', {remoteAddress: socket.handshake.address, socket: socket});

  if (!addedUser) {
    socket.username = generateName();
    // add the client's username to the global list
    usernames[socket.username] = socket.username;
    ++numUsers;

    addedUser = true;

    // emit a login to return username and number of connected users
    socket.emit('login', {
      numUsers: numUsers,
      username: socket.username
    });

    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
    logger('Logged', {remoteAddress: socket.handshake.address, socket: socket});    
  }

  // broadcasts the play_url command to all connected clients
  socket.on('play', function(url) {
    socket.broadcast.emit('play_url', {
      url: url,
      username: socket.username,
      numUsers: numUsers
    });
    logger('Play requested, broadcasting play_url ' + url, {remoteAddress: socket.handshake.address, socket: socket});
  });

  // broadcasts the stop command to all connected clients
  socket.on('stopPlayback', function() {
    socket.broadcast.emit('stop');
    logger('Requested stopPlayback, broadcasting stop ', {remoteAddress: socket.handshake.address, socket: socket});
  });


  // generates a JSON with the name and absolute url path of sound assets
  socket.on('getSoundList', function() {
    logger('Soundlist requested', {remoteAddress: socket.handshake.address, socket: socket});
    fs.readdir(uploadsPath, function(err, files) {
      var tmpSoundlist = {};
      if (err == undefined) {
        for (var i = 0; i < files.length; i++) {
          tmpSoundlist[i] = {
            name: files[i].replace('.mp3', ''),
            url: fqdn + uploadsWebPath + '/' + files[i]
          }
        }
        soundList = tmpSoundlist;

        socket.emit('soundList', {
          soundList: soundList
        });
        logger('Soundlist returned', {remoteAddress: socket.handshake.address, socket: socket});

      }
    });
  });

  // when the user disconnects, remove it from the userlist and send logout broadcast
  socket.on('disconnect', function() {
    if (addedUser) {
      delete usernames[socket.username];
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
    logger('Left', {remoteAddress: socket.handshake.address, socket: socket});

  });
});


/*
 *   TTS
 */

app.get('/tts', function(req, res) {
  var remoteAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  var lang = req.query.lang;
  var text = req.query.text;

  logger('TTS: requested for lang ' + req.query.lang + ' text: ' + req.query.text, {remoteAddress: remoteAddress});

  if (text == undefined || lang == undefined || text == '' || lang == '') {
    res.send('Error on query string');
      logger('TTS: reported error on input', {remoteAddress: remoteAddress});
    return;
  }

  //Generating a new tmp filename (won't be used directly, see below)
  var tmpPath = tmp.tmpNameSync({
    template: '/tmp/tmp-XXXXXX'
  });

  var wavePath = tmpPath + '.wav';
  var mp3Path = tmpPath + '.mp3';

  var ttsCMD = ['pico2wave', '-w', wavePath, '-l', lang, text];
  logger('TTS Executing command: ' + shellescape(ttsCMD), {remoteAddress: remoteAddress});

  if (exec(shellescape(ttsCMD)).code == 0) {
    logger('TTS OK', {remoteAddress: remoteAddress});
    var wav2mp3CMD = ['avconv', '-i', wavePath, mp3Path]
    logger('TTS: Executing command: ' + shellescape(wav2mp3CMD), {remoteAddress: remoteAddress});

    if (exec(shellescape(wav2mp3CMD)).code == 0) {
      logger('TTS: Wave to MP3 OK', {remoteAddress: remoteAddress});
      res.sendFile(mp3Path);
    } else {
      logger('TTS: Wave to MP3 KO', {remoteAddress: remoteAddress});
      res.send('Well mate, this is really weird. Something that was never supposed to fail, just failed. I guess sh!t happens. Lame error. No, really.');
    }
  } else {
    logger('TTS failed', {remoteAddress: remoteAddress});
    res.send('TTS failed: are you passing a proper ISO lang code? Are you trying to do funky stuff with text? I\'m watching you.');
  }

});

/*
 *   WaveUploader (for push to talk)
 */

app.post('/uploadWav', [multer({
  dest: __dirname + '/public/uploads/'
}), function(req, res) {
  var remoteAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

  logger('Upload received and saved to ' + req.files.file, {remoteAddress: remoteAddress});

  var avconvCMD = 'avconv -i ' + req.files.file.path + ' ' + req.files.file.path + '.mp3';

  logger('Executing ' + avconvCMD, {remoteAddress: remoteAddress});

  if (exec(avconvCMD).code == 0) {
    logger('conversion OK', {remoteAddress: remoteAddress});
  } else logger('conversion KO', {remoteAddress: remoteAddress});
  exec('rm ' + req.files.file.path);
  res.send(fqdn + '/uploads/' + req.files.file.name + '.mp3').end()
}]);
