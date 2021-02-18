/* See also:
    http://www.html5rocks.com/en/tutorials/webrtc/basics/
    https://code.google.com/p/webrtc-samples/source/browse/trunk/apprtc/index.html

    https://webrtc-demos.appspot.com/html/pc1.html
*/

async function waitForAnswer() {
  console.log('Waiting for answer...');
  try {
    let response = await fetch('/answer/audio');
    if(response.ok) {
      let desc = await response.json();
      if(desc.type === 1) {
        desc.type = 'answer';
      }
      var answerDesc = new RTCSessionDescription(desc);
      handleAnswerFromPC2(answerDesc)
    } else {
      setTimeout(waitForAnswer, 1000);
    }
  } catch(e){
    console.error('UHOH', e);
    setTimeout(waitForAnswer, 1000);
  }
}


var cfg = {'iceServers': [
  // {'urls': 'stun:stun.l.google.com:19302'}
        {
          urls: ['turn:turn.mayfly.live'],
          credential: 'world',
          username: 'hello'
      },
]},
  con = { 'optional': [{'DtlsSrtpKeyAgreement': true}] }

/* THIS IS ALICE, THE CALLER/SENDER */

var pc1 = new RTCPeerConnection(cfg, con);

var pc1icedone = false

var sdpConstraints = {
  optional: [],
  mandatory: {
    OfferToReceiveAudio: true,
    OfferToReceiveVideo: false
  }
}

requestAnimationFrame(createLocalOffer);

async function createLocalOffer () {
  console.log('video1')
  try {
    let stream = await navigator.mediaDevices.getUserMedia({video: false, audio: true})

    var video = document.getElementById('localVideo')
    video.srcObject = stream
    video.play()
    
    stream.getTracks().forEach(function(track) {
      pc1.addTrack(track, stream);
    });
    console.log(stream)
    console.log('adding stream to pc1')
    try {
      const desc = await pc1.createOffer(sdpConstraints)
      pc1.setLocalDescription(desc)
      console.log('created local offer', desc)
    } catch(error){
      console.warn("Couldn't create offer", error)
    }
  } catch (error) {
    console.log('Error adding stream to pc1: ' + error)
  }
}

pc1.onicecandidate = async e => {
  console.log(`ICE candidate (pc1) ${e.candidate && e.candidate.candidate}`)
  if (e.candidate == null) {
    let body = JSON.stringify({
      type:'offer',
      sdp: pc1.localDescription.sdp
    })
    await fetch('/offer/audio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body
    });
    waitForAnswer();
  }
}

function handleOnaddtrack (e) {
  console.log('Got remote track', e)
  var el = document.getElementById('remoteAudio')
  el.autoplay = true;
  el.srcObject = e.streams[0];
}

pc1.ontrack = handleOnaddtrack

function onsignalingstatechange (state) {
  console.info('signaling state change:', state)
}

function oniceconnectionstatechange (state) {
  console.info('ice connection state change:', state)
}

function onicegatheringstatechange (state) {
  console.info('ice gathering state change:', state)
}

pc1.onsignalingstatechange = onsignalingstatechange
pc1.oniceconnectionstatechange = oniceconnectionstatechange
pc1.onicegatheringstatechange = onicegatheringstatechange

function handleAnswerFromPC2 (answerDesc) {
  console.log('Received remote answer: ', answerDesc)
  pc1.setRemoteDescription(answerDesc)
}

function handleCandidateFromPC2 (iceCandidate) {
  pc1.addIceCandidate(iceCandidate)
}