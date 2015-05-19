var socket = io();
var appStatus = {}
var myUsername;
var localAudio = new Audio();
var localPlayback = document.getElementById("localPlaybackToggle").checked;
var remotePlayback = document.getElementById("remotePlaybackToggle").checked;
var verboseLogging = document.getElementById("verboseToggle").checked;

function remotePlayUrl(url) {
  if (remotePlayback) {
    socket.emit("play", url);
    log("You fired " + url);
  }
}

function setConnectedUsers(numUsers) {
  appStatus.connectedUsers = numUsers;
  document.getElementById("connectedUsersLabel").innerHTML= appStatus.connectedUsers + " connected users";
}

function log(text) {
  console.log(text);
  if (verboseLogging)
    document.getElementById('chat-box').innerHTML += "<br/>" + text;
}

function playLocalUrl(url) {
  if (localPlayback) {
    localAudio.src = url;
    localAudio.play();
    log("You are locally playing " + url);
  }
}

function stopLocalPlayer() {
  localAudio.pause();
}

function fireStop() {
  localAudio.pause();
  socket.emit('stopPlayback');
  log("You have requested playback to be stopped");

}

function parseSoundsJson(soundList) {
  for (var i in soundList) {
    var sound = soundList[i];

    var newButton = document.createElement('a');
    newButton.className = 'btn btn-primary btn-lg';
    newButton.role = 'button';
    newButton.id = 'but-' + sound.name;
    newButton.innerHTML = sound.name.toUpperCase();
    newButton.url = sound.url;
    newButton.name = sound.name;

    document.getElementById('buttons-container').appendChild(newButton);

    document.getElementById(newButton.id).addEventListener('click', function() {
      remotePlayUrl(this.url);
      playLocalUrl(this.url);
    }, false);
  }
}

socket.emit('getSoundList');
log("Requesting soundlist...");

// Whenever the server emits 'login', log the login message
socket.on('login', function(data) {
  myUsername = data.username;
  log("Welcome to Noizes, " + myUsername);
  log(data.numUsers + ' users are currently connected');
  setConnectedUsers(data.numUsers);
});

socket.on('play_url', function(data) {
  log(data.username + ' is playing ' + data.url);
  playLocalUrl(data.url);
});

// Whenever the server emits 'user joined', log it in the chat body
socket.on('user joined', function(data) {
  log(data.username + ' joined');
  log(data.numUsers + ' users are currently connected');
  setConnectedUsers(data.numUsers);
});

// Whenever the server emits 'user left', log it in the chat body
socket.on('user left', function(data) {
  log(data.username + ' left');
  setConnectedUsers(data.numUsers);
});

socket.on('soundList', function(data) {
  parseSoundsJson(data.soundList);
  log('SoundList returned : ' + data.soundList);
});

socket.on('stop', function() {
  stopLocalPlayer();
  log('stop received: stopped local player');
});

function toggleLocalPlayback() {
  localPlayback = document.getElementById("localPlaybackToggle").checked;
}

function toggleRemotePlayback() {
  remotePlayback = document.getElementById("remotePlaybackToggle").checked;
}

function toggleVerbose() {
  verboseLogging = document.getElementById("verboseToggle").checked;
}

function fireTTS() {
  var lang = document.getElementById("tts-lang").value;
  var text = document.getElementById("tts-text").value;
  var ttsURL = window.location.origin + "/tts?lang=" + lang + "&text=" + text;
  remotePlayUrl(ttsURL);
  playLocalUrl(ttsURL);
  console.log(ttsURL);
}

function invokeTTS(lang, text) {
  var ttsURL = window.location.origin + "/tts?lang="+lang+"&text=" + text;
  remotePlayUrl(ttsURL);
  playLocalUrl(ttsURL);
  console.log(ttsURL);  
}

function proverb(lang) {

  var oReq = new XMLHttpRequest();

  oReq.onload = function reqListener () {
    var lines = this.responseText.split('\n');
    invokeTTS(lang, lines[Math.floor(Math.random()*lines.length)]);
  }

  oReq.open("get", '/proverbs_'+lang+'.txt', true);
  oReq.send();

}
