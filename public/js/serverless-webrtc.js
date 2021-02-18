/* See also:
    http://www.html5rocks.com/en/tutorials/webrtc/basics/
    https://code.google.com/p/webrtc-samples/source/browse/trunk/apprtc/index.html

    https://webrtc-demos.appspot.com/html/pc1.html
*/

let startTime = Date.now();

async function waitForOffer() {
  console.log('Waiting for offer...');
  try {
    let response = await fetch('/offer/web');
    if (response.ok) {
      let desc = await response.json();
      if (desc.type === 0) {
        desc.type = 'offer';
      }
      var offerDesc = new RTCSessionDescription(desc);
      startTime = Date.now();
      handleOfferFromPC1(offerDesc);
    } else {
      setTimeout(waitForOffer, 1000);
    }
  } catch (e) {
    setTimeout(waitForOffer, 1000);
  }
}

async function waitForAnswer() {
  console.log('Waiting for answer...');
  try {
    let response = await fetch('/answer/web');
    if (response.ok) {
      let desc = await response.json();
      if (desc.type === 1) {
        desc.type = 'answer';
      }
      var answerDesc = new RTCSessionDescription(desc);
      handleAnswerFromPC2(answerDesc)
    } else {
      setTimeout(waitForAnswer, 1000);
    }
  } catch (e) {
    setTimeout(waitForAnswer, 1000);
  }
}


var cfg = {
  iceServers: [
    // {'urls': 'stun:stun.l.google.com:19302'},
    {
      url: 'turn:turn.mayfly.live',
      credential: 'world',
      username: 'hello'
    },
  ],
  iceTransportPolicy: 'relay'
},
  con = { 'optional': [{ 'DtlsSrtpKeyAgreement': true }] }

/* THIS IS ALICE, THE CALLER/SENDER */

var pc1 = new RTCPeerConnection(cfg, con);

// Since the same JS file contains code for both sides of the connection,
// activedc tracks which of the two possible datachannel variables we're using.
var activedc

var pc1icedone = false

var sdpConstraints = {
  optional: [],
  mandatory: {
    OfferToReceiveAudio: true,
    OfferToReceiveVideo: true
  }
}

$('#showLocalOffer').modal('hide')
$('#getRemoteAnswer').modal('hide')
$('#waitForConnection').modal('hide')
$('#createOrJoin').modal('show')

$('#createBtn').click(function () {
  requestAnimationFrame(createLocalOffer)
})

$('#joinBtn').click(async function () {
  prepareForRemoteOffer();
})

requestAnimationFrame(() => {
  console.log('HMM', location.search)
  if (location.search === '?join') {
    $('#joinBtn').click();
  } else if (location.search === '?create') {
    $('#createBtn').click();
  }
})

async function prepareForRemoteOffer() {
  try {
    let stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    var video = document.getElementById('localVideo')
    video.srcObject = stream;
    video.play()

    stream.getTracks().forEach(function (track) {
      pc2.addTrack(track, stream);
    });
    waitForOffer();
  } catch (error) {
    console.log('Error adding stream to pc2: ' + error)
  }
}

function sendMessage() {
  if ($('#messageTextBox').val()) {
    var channel = new RTCMultiSession()
    writeToChatLog($('#messageTextBox').val(), 'text-success')
    channel.send({ message: $('#messageTextBox').val() })
    $('#messageTextBox').val('')

    // Scroll chat text area to the bottom on new input.
    $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight)
  }

  return false
}

function setupDC1() {
  try {
    var fileReceiver1 = new FileReceiver()
    dc1 = pc1.createDataChannel('test', { reliable: true })
    activedc = dc1
    console.log('Created datachannel (pc1)')
    dc1.onopen = function (e) {
      console.log('data channel connect')
      $('#waitForConnection').modal('hide')
      $('#waitForConnection').remove()
    }
    dc1.onmessage = function (e) {
      console.log('Got message (pc1)', e.data)
      if (e.data.size) {
        fileReceiver1.receive(e.data, {})
      } else {
        if (e.data.charCodeAt(0) == 2) {
          // The first message we get from Firefox (but not Chrome)
          // is literal ASCII 2 and I don't understand why -- if we
          // leave it in, JSON.parse() will barf.
          return
        }
        console.log(e)
        var data = JSON.parse(e.data)
        if (data.type === 'file') {
          fileReceiver1.receive(e.data, {})
        } else {
          writeToChatLog(data.message, 'text-info')
          // Scroll chat text area to the bottom on new input.
          $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight)
        }
      }
    }
  } catch (e) { console.warn('No data channel (pc1)', e); }
}

async function createLocalOffer() {
  console.log('video1')
  try {
    let stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })

    var video = document.getElementById('localVideo')
    video.srcObject = stream
    video.play()

    stream.getTracks().forEach(function (track) {
      pc1.addTrack(track, stream);
    });
    console.log(stream)
    console.log('adding stream to pc1')
    setupDC1()
    try {
      const desc = await pc1.createOffer(sdpConstraints)
      pc1.setLocalDescription(desc)
      console.log('created local offer', desc)
    } catch (error) {
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
      type: 'offer',
      sdp: pc1.localDescription.sdp
    })
    await fetch('/offer/web', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body
    });
    waitForAnswer();
    $('#localOffer').html(JSON.stringify())
  }
}

function handleOnaddstream(e) {
  console.log('Got remote stream', e.stream)
  var el = document.getElementById('remoteVideo')
  el.autoplay = true
  el.srcObject = e.stream
  console.log(`TOTAL TIME ${(Date.now()-startTime)/1000}sec for ${cfg.iceServers[0].url}`);
}

pc1.onaddstream = handleOnaddstream

function handleOnconnection() {
  console.log('Datachannel connected')
  writeToChatLog('Datachannel connected', 'text-success')
  $('#waitForConnection').modal('hide')
  // If we didn't call remove() here, there would be a race on pc2:
  //   - first onconnection() hides the dialog, then someone clicks
  //     on answerSentBtn which shows it, and it stays shown forever.
  $('#waitForConnection').remove()
  $('#showLocalAnswer').modal('hide')
  $('#messageTextBox').focus()
}

pc1.onconnection = handleOnconnection

function onsignalingstatechange(state) {
  console.info('signaling state change:', state)
}

function oniceconnectionstatechange(state) {
  console.info('ice connection state change:', state)
}

// function onicegatheringstatechange(state) {
//   console.info('ice gathering state change:', state)
// }

pc1.onsignalingstatechange = onsignalingstatechange
pc1.oniceconnectionstatechange = oniceconnectionstatechange
// pc1.onicegatheringstatechange = onicegatheringstatechange

function handleAnswerFromPC2(answerDesc) {
  console.log('Received remote answer: ', answerDesc)
  writeToChatLog('Received remote answer', 'text-success')
  pc1.setRemoteDescription(answerDesc)
}

function handleCandidateFromPC2(iceCandidate) {
  pc1.addIceCandidate(iceCandidate)
}

/* THIS IS BOB, THE ANSWERER/RECEIVER */

var pc2 = new RTCPeerConnection(cfg, con),
  dc2 = null

var pc2icedone = false

pc2.ondatachannel = function (e) {
  var fileReceiver2 = new FileReceiver()
  var datachannel = e.channel || e; // Chrome sends event, FF sends raw channel
  console.log('Received datachannel (pc2)', arguments)
  dc2 = datachannel
  activedc = dc2
  dc2.onopen = function (e) {
    console.log('data channel connect')
    $('#waitForConnection').modal('hide')
    $('#waitForConnection').remove()
  }
  dc2.onmessage = function (e) {
    console.log('Got message (pc2)', e.data)
    if (e.data.size) {
      fileReceiver2.receive(e.data, {})
    } else {
      var data = JSON.parse(e.data)
      if (data.type === 'file') {
        fileReceiver2.receive(e.data, {})
      } else {
        writeToChatLog(data.message, 'text-info')
        // Scroll chat text area to the bottom on new input.
        $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight)
      }
    }
  }
}

async function handleOfferFromPC1(offerDesc) {
  pc2.setRemoteDescription(offerDesc)
  try {
    const answerDesc = await pc2.createAnswer(sdpConstraints);
    writeToChatLog('Created local answer', 'text-success')
    console.log('Created local answer: ', answerDesc)
    pc2.setLocalDescription(answerDesc)
  } catch (error) {
    console.warn("Couldn't create answer")
  }
}

pc2.onicecandidate = async e => {
  console.log(`ICE candidate (pc2) ${e.candidate && e.candidate.candidate}`)
  if (e.candidate == null) {
    let body = JSON.stringify({
      type: 1,
      sdp: pc2.localDescription.sdp
    })
    await fetch('/answer/web', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body
    });
  }
}

pc2.onsignalingstatechange = onsignalingstatechange
pc2.oniceconnectionstatechange = oniceconnectionstatechange
// pc2.onicegatheringstatechange = onicegatheringstatechange

function handleCandidateFromPC1(iceCandidate) {
  pc2.addIceCandidate(iceCandidate)
}

pc2.onaddstream = handleOnaddstream
pc2.onconnection = handleOnconnection

function getTimestamp() {
  var totalSec = new Date().getTime() / 1000
  var hours = parseInt(totalSec / 3600) % 24
  var minutes = parseInt(totalSec / 60) % 60
  var seconds = parseInt(totalSec % 60)

  var result = (hours < 10 ? '0' + hours : hours) + ':' +
    (minutes < 10 ? '0' + minutes : minutes) + ':' +
    (seconds < 10 ? '0' + seconds : seconds)

  return result
}

function writeToChatLog(message, message_type) {
  document.getElementById('chatlog').innerHTML += '<p class="' + message_type + '">' + '[' + getTimestamp() + '] ' + message + '</p>'
}
