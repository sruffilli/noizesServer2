// Port used by the service
const port = 8888;
// FQDN (+ port). Will be used to return a soundlist with full absolute paths
const fqdn = "http://localhost:" + port;

// Lovely requirements
require('shelljs/global');
var fs = require("fs");
var shellescape = require('shell-escape');
var tmp = require('tmp');

//express + socket.io setup
var express = require('express');
var multer = require('multer');
var app = express();
var webServer = require('http').createServer(app);

webServer.listen(port, function() {
  console.log('Server listening at port %d', port);
});

/*
 *   Routing path for static assets (Webapp + sounds)
 */

app.use(express.static(__dirname + '/public'));

/*
 *   Websocket
 */

var io = require('socket.io')(webServer);

// A "sillyname" will automatically be generated for every client connecting to the service
var generateName = require('sillyname');

// Where the sounds are stored, relative to the app
var uploadsPath = "./public/assets";
// Where the sounds can be retrieved relative to the public dir
var uploadsWebPath = "/assets"

var soundList = {};

// usernames which are currently connected to the chat
var usernames = {};
var numUsers = 0;

io.on('connection', function(socket) {
  var addedUser = false;
  // when the client emits 'add user', this listens and executes
  socket.on('add user', function() {
    // we store the username in the socket session for this client
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
    console.log(socket.username + " joined")
  });


  // broadcasts the play_url command to all connected clients
  socket.on('play', function(url) {
    socket.broadcast.emit('play_url', {
      url: url,
      username: socket.username,
      numUsers: numUsers
    });
    console.log(socket.username + " played " + url);
  });

  // broadcasts the stop command to all connected clients
  socket.on('stopPlayback', function() {
    socket.broadcast.emit('stop');
    console.log(socket.username + " requested stop ");
  });


  // generates a JSON with the name and absolute url path of sound assets
  socket.on('getSoundList', function() {
    console.log("Returning soundList:" + soundList);

    fs.readdir("./" + uploadsPath, function(err, files) {
      console.log(JSON.stringify(files));
      var tmpSoundlist = {};
      if (err == undefined) {
        for (var i = 0; i < files.length; i++) {
          tmpSoundlist[i] = {
            name: files[i].replace(".mp3", ""),
            url: fqdn + uploadsWebPath + "/" + files[i]
          }
        }
        soundList = tmpSoundlist;

        socket.emit("soundList", {
          soundList: soundList
        });
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
    console.log(socket.username + " left");

  });
});


/*
 *   TTS
 */

app.get('/tts', function(req, res) {
  var lang = req.query.lang;
  var text = req.query.text;

  if (text == undefined || lang == undefined || text == "" || lang == "") {
    res.send("Error on query string");
    exit(1);
  }

  console.log(req.query.lang + " " + req.query.text);

  //Generating a new tmp filename (won't be used directly, see below)
  var tmpPath = tmp.tmpNameSync({
    template: '/tmp/tmp-XXXXXX'
  });

  var wavePath = tmpPath + ".wav";
  var mp3Path = tmpPath + ".mp3";

  var ttsCMD = ['pico2wave', '-w', wavePath, '-l', lang, text];
  console.log("Executing command: " + shellescape(ttsCMD));

  if (exec(shellescape(ttsCMD)).code == 0) {
    console.log("TTS OK");
    var wav2mp3CMD = ['avconv', '-i', wavePath, mp3Path]
    console.log("Executing command: " + shellescape(wav2mp3CMD));

    if (exec(shellescape(wav2mp3CMD)).code == 0) {
      console.log("Wave to MP3 OK");
      res.sendFile(mp3Path);
    } else {
      console.log("Wave to MP3 KO");
      res.send("Well mate, this is really weird. Something that was never supposed to fail, just failed. I guess sh!t happens. Lame error. No, really.");
    }
  } else {
    console.log("TTS failed");
    res.send("TTS failed: are you passing a proper ISO lang code? Are you trying to do funky stuff with text? I'm watching you.");
  }

});

/*
 *   WaveUploader (for push to talk)
 */

app.post('/uploadWav', [multer({
  dest: './public/uploads/'
}), function(req, res) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

  console.log("Upload received and saved to " + req.files.file);

  var avconvCMD = 'avconv -i ' + req.files.file.path + ' ' + req.files.file.path + '.mp3';

  console.log("Executing " + avconvCMD);

  if (exec(avconvCMD).code == 0) {
    console.log("conversion OK");
  } else console.log("conversion KO");
  exec('rm ' + req.files.file.path);
  res.send(fqdn + '/uploads/' + req.files.file.name + '.mp3').end()
}]);