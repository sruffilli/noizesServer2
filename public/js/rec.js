function __log(e, data) {
  //log.innerHTML += "\n" + e + " " + (data || '');
}

var audio_context;
var recorder;
var askedUserConsent = false;

function startUserMedia(stream) {
  var input = audio_context.createMediaStreamSource(stream);
  __log('Media stream created.');
  recorder = new Recorder(input);
  __log('Recorder initialised.');
}

function startRecording(button) {
  if (!askedUserConsent) {
    navigator.getUserMedia({
      audio: true
    }, startUserMedia, function(e) {
      __log('No live audio input: ' + e);
    });
    recorder && recorder.record();
    recorder && recorder.stop();
    askedUserConsent = true;

  } else {

    recorder && recorder.record();
    button.disabled = true;
    button.nextElementSibling.disabled = false;
    __log('Recording...');
  }
}

function stopRecording(button) {
  recorder && recorder.stop();
  button.disabled = true;
  button.previousElementSibling.disabled = false;
  __log('Stopped recording.');

  // create WAV download link using audio data blob
  upload();

  recorder.clear();
}

function upload() {
  recorder && recorder.exportWAV(function(blob) {
    uploadBlob(blob);
  });
}

function uploadBlob(blob) {

  var xmlHttpRequest = new XMLHttpRequest();
  xmlHttpRequest.open("POST", '/uploadWav', true);

  xmlHttpRequest.onload = function(e) {
    if (xmlHttpRequest.readyState === 4) {
      if (xmlHttpRequest.status === 200) {
        console.log(xmlHttpRequest.responseText);
        remotePlayUrl(xmlHttpRequest.responseText);
      } else {
        console.error(xmlHttpRequest.statusText);
      }
    }
  };

  var formData = new FormData();
  // This should automatically set the file name and type.
  formData.append("file", blob);
  // Sending FormData automatically sets the Content-Type header to multipart/form-data
  xmlHttpRequest.send(formData);

}

window.onload = function init() {
  try {
    // webkit shim
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia;
    window.URL = window.URL || window.webkitURL;

    audio_context = new AudioContext;
    __log('Audio context set up.');
    __log('navigator.getUserMedia ' + (navigator.getUserMedia ? 'available.' : 'not present!'));
  } catch (e) {
    alert('No web audio support in this browser!');
  }


};