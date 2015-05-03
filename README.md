# noizesServer

noizesServer is a cooperative soundbox developed for fun, to tinker with nodeJS, express and socket.io. In fact, this is the first time I'm working with nodejs, so be kind ;)

This server exposes both a web application (which you will find at "/"), and a couple of "APIs", so far:
- a TTS pased on pico, which given a lang and a text returns an mp3 "speech" file 
- a file uploader which expects a .wav file via POST, which is then converted to MP3 whose URL is returned to the call

## Installation

noizesServer requires nodejs :), libttspico-utils (for optional TTS, pico2wave), libav-tools (for avconv), libavcodec-extra-53 for mp3 transcoding, and [Bower], to install libraries needed by the web application

NPM and Bower modules can be installed after git clone-ing the repository.

```sh
$ sudo apt-get update
$ sudo apt-get install git nodejs libttspico-utils libav-tools libavcodec-extra-53
$ cd /your/preferred/path
$ git clone https://github.com/sruffilli/noizesServer2.git
$ cd noizesServer2
$ npm install
$ cd public
$ bower install
```
After the installation, make sure to change the fqdn constant on server.js, located in the main directory of the project

[Bower]:http://bower.io/
