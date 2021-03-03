/* See also:
    http://www.html5rocks.com/en/tutorials/webrtc/basics/
    https://code.google.com/p/webrtc-samples/source/browse/trunk/apprtc/index.html

    https://webrtc-demos.appspot.com/html/pc1.html
*/


const iceTimeout = 5 * 1000;

async function waitForAudioOffer() {
    console.log('Waiting for audio offer...');
    try {
        let response = await fetch('/offer/audio');
        if (response.ok) {
            let desc = await response.json();
            if (desc.type === 0) {
                desc.type = 'offer';
            }
            var offerDesc = new RTCSessionDescription(desc);
            handleOfferFromAudio(offerDesc);
        } else {
            setTimeout(waitForAudioOffer, 1000);
        }
    } catch (e) {
        setTimeout(waitForAudioOffer, 1000);
    }
}
async function waitForVideoOffer() {
    console.log('Waiting for video offer...');
    try {
        let response = await fetch('/offer/video');
        if (response.ok) {
            let desc = await response.json();
            if (desc.type === 0) {
                desc.type = 'offer';
            }
            var offerDesc = new RTCSessionDescription(desc);
            handleOfferFromVideo(offerDesc);
        } else {
            setTimeout(waitForVideoOffer, 1000);
        }
    } catch (e) {
        setTimeout(waitForVideoOffer, 1000);
    }
}


var cfg = {
    'iceServers': [
        // {'urls': 'stun:stun.l.google.com:19302'},
        {
            urls: ['turn:turn.mayfly.live'],
            credential: 'world',
            username: 'hello'
        },
    ],
    // iceTransportPolicy: 'relay'
},
    con = { 'optional': [{ 'DtlsSrtpKeyAgreement': true }] }


var sdpConstraintsAudio = {
    optional: [],
    mandatory: {
        OfferToReceiveAudio: true,
        OfferToReceiveVideo: false
    }
}, sdpConstraintsVideo = {
    optional: [],
    mandatory: {
        OfferToReceiveAudio: false,
        OfferToReceiveVideo: true
    }
};


var pcAudio = new RTCPeerConnection(cfg, con),
    pcVideo = new RTCPeerConnection(cfg, con),
    pcAudioIceDone = false,
    pcVideoIceDone = false,
    dc = null;

pcVideo.onsignalingstatechange = onsignalingstatechange
pcVideo.oniceconnectionstatechange = oniceconnectionstatechange
pcVideo.onicegatheringstatechange = onicegatheringstatechange
pcVideo.onaddstream = handleOnAddVideoStream

pcAudio.onsignalingstatechange = onsignalingstatechange
pcAudio.oniceconnectionstatechange = oniceconnectionstatechange
pcAudio.onicegatheringstatechange = onicegatheringstatechange
pcAudio.onaddstream = handleOnAddAudioStream

requestAnimationFrame(prepareForRemoteOffer);

async function prepareForRemoteOffer() {
    try {
        let stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
        var audio = document.getElementById('localAudio')
        audio.srcObject = stream;
        audio.play()

        stream.getTracks().forEach(function (track) {
            if (track.kind === 'audio') {
                pcAudio.addTrack(track, stream);
            }
        });
        if(location.search === '?videoonly'){
            waitForVideoOffer();
        } else if (location.search === '?audioonly'){
            waitForAudioOffer();
        } else {
            waitForAudioOffer();
            waitForVideoOffer();
        }
        createAnalyser(stream, 'analyserPerformer');
    } catch (error) {
        console.log('Error adding stream to pc2: ' + error)
    }
}

function handleOnAddAudioStream(e) {
    console.log('Got remote audio stream', e.stream)
    var el = document.getElementById('remoteAudio')
    el.autoplay = true
    el.srcObject = e.stream
    createAnalyser(e.stream, 'analyserAttendee');
}

function handleOnAddVideoStream(e) {
    console.log('Got remote video stream', e.stream)
    var el = document.getElementById('remoteVideo')
    el.autoplay = true
    el.srcObject = e.stream
}

function onsignalingstatechange(state) {
    console.info('signaling state change:', state)
}

function oniceconnectionstatechange(state) {
    console.info('ice connection state change:', state)
}

function onicegatheringstatechange(state) {
    console.info('ice gathering state change:', state)
}

async function handleOfferFromAudio(offerDesc) {
    pcAudio.setRemoteDescription(offerDesc)
    try {
        const answerDesc = await pcAudio.createAnswer(sdpConstraintsAudio);
        console.log('Created local answer: ', answerDesc)
        pcAudio.setLocalDescription(answerDesc)
        setTimeout(pcAudioSendAnswer, iceTimeout);
    } catch (error) {
        console.warn("Couldn't create answer")
    }
}

async function handleOfferFromVideo(offerDesc) {
    pcVideo.setRemoteDescription(offerDesc)
    try {
        const answerDesc = await pcVideo.createAnswer(sdpConstraintsVideo);
        console.log('Created local answer: ', answerDesc)
        pcVideo.setLocalDescription(answerDesc);
        setTimeout(pcVideoSendAnswer, iceTimeout);
    } catch (error) {
        console.warn("Couldn't create answer")
    }
}

pcAudio.onicecandidate = async e => {
    console.log(`ICE candidate (pcAudio) ${e.candidate && e.candidate.candidate}`)
    if (e.candidate == null) {
        pcAudioSendAnswer();
    }
}

pcAudio.ondatachannel = function (e) {
  var datachannel = e.channel || e; // Chrome sends event, FF sends raw channel
  console.log('Received datachannel (pc2)', arguments)
  dc = datachannel
  dc.onopen = () => {
    console.log('data channel connect');
  };
  dc.onmessage = (e) => {
    console.log('Got message (pc2)', e.data);
    let msg = JSON.parse(e.data);
    switch(msg.type){
        case 'AnimationEvent':
            document.getElementById('current-event').innerText = msg.name;
            break;
        default:
            console.log(`No handler for type ${msg.type}`);
    }
  }
}

async function pcAudioSendAnswer(){
    if(!pcAudioIceDone){
        pcAudioIceDone = true;
        let body = JSON.stringify({
            type: 1,
            sdp: pcAudio.localDescription.sdp
        })
        await fetch('/answer/audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body
        });
    }
}


pcVideo.onicecandidate = async e => {
    console.log(`ICE candidate (pcVideo) ${e.candidate && e.candidate.candidate}`)
    if (e.candidate == null) {
        pcVideoSendAnswer();
    }
}

async function pcVideoSendAnswer(){
    if(!pcVideoIceDone){
        pcVideoIceDone = true;
        let body = JSON.stringify({
            type: 1,
            sdp: pcVideo.localDescription.sdp
        })
        await fetch('/answer/video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body
        });
    }
}

function handleCandidateFromPC1(iceCandidate) {
    pcAudio.addIceCandidate(iceCandidate)
}


// shim for AudioContext when it's not avb. 
let AudioContext = window.AudioContext || window.webkitAudioContext;

async function createAnalyser(stream, canvasId) {
    var audioContext, splitter, merger, inputPoint, analyserNode, input, rafID, analyserContext, canvas, canvasWidth, canvasHeight;
    audioContext = new AudioContext();

    splitter = audioContext.createChannelSplitter(2);
    merger = audioContext.createChannelMerger(2);

    splitter.connect(merger, 0, 0);
    splitter.connect(merger, 0, 1);

    inputPoint = audioContext.createGain();
    merger.connect(inputPoint);

    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;
    inputPoint.connect(analyserNode);

    input = audioContext.createMediaStreamSource(stream);
    input.connect(splitter);

    !function updateAnalysers() {
        rafID && window.cancelAnimationFrame(rafID);
        if (!analyserContext) {
            canvas = document.getElementById(canvasId);
            analyserContext = canvas.getContext('2d');
        }
        canvas.width = window.innerWidth - 10;
        canvasWidth = canvas.width;
        canvasHeight = canvas.height;

        // analyzer draw code here
        {
            var SPACING = 12;
            var BAR_WIDTH = 10;
            var numBars = Math.round(canvasWidth / SPACING);
            var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);

            analyserNode.getByteFrequencyData(freqByteData);

            analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
            analyserContext.fillStyle = '#F6D565';
            analyserContext.lineCap = 'round';
            var multiplier = analyserNode.frequencyBinCount / numBars;
            var canvasMid = canvasHeight / 2;

            // Draw rectangle for each frequency bin.
            for (var i = 0; i < numBars; ++i) {
                var magnitude = 0;
                var offset = Math.floor(i * multiplier);
                // gotta sum/average the block, or we miss narrow-bandwidth spikes
                for (var j = 0; j < multiplier; j++)
                    magnitude += freqByteData[offset + j];
                magnitude = magnitude / multiplier;
                var magnitude2 = freqByteData[i * multiplier];
                analyserContext.fillStyle = "hsl( " + Math.round((i * 360) / numBars) + ", 100%, 50%)";
                analyserContext.fillRect(i * SPACING, canvasMid - magnitude / 2, BAR_WIDTH, magnitude);
            }
        }

        rafID = window.requestAnimationFrame(updateAnalysers);
    }();
}

document.getElementById("Idle").onclick = () => { dc && dc.send(JSON.stringify({ type: 'QueueAnimation', content: 'Idle'}))};
document.getElementById("Sit").onclick = () => { dc && dc.send(JSON.stringify({ type: 'QueueAnimation', content: 'Sit'}))};
document.getElementById("Surprised").onclick = () => { dc && dc.send(JSON.stringify({ type: 'QueueAnimation', content: 'Surprised'}))};
document.getElementById("Concerned").onclick = () => { dc && dc.send(JSON.stringify({ type: 'QueueAnimation', content: 'Concerned'}))};
document.getElementById("GestureArmsUp").onclick = () => { dc && dc.send(JSON.stringify({ type: 'QueueAnimation', content: 'GestureArmsUp'}))};
document.getElementById("GestureArmsForward").onclick = () => { dc && dc.send(JSON.stringify({ type: 'QueueAnimation', content: 'GestureArmsForward'}))};
document.getElementById("Book").onclick = () => { dc && dc.send(JSON.stringify({ type: 'QueueAnimation', content: 'Book'}))};

// document.getElementById('KnockLoop').onclick = () => { dc && dc.send(JSON.stringify({ type: 'QueueAnimation', content: 'KnockLoop'}))}
// document.getElementById('WatchWindowOpen').onclick = () => { dc && dc.send(JSON.stringify({ type: 'QueueAnimation', content: 'WatchWindowOpen'}))}
// document.getElementById('LandOnSill').onclick = () => { dc && dc.send(JSON.stringify({ type: 'QueueAnimation', content: 'LandOnSill'}))}
// document.getElementById('IdleOnSill').onclick = () => { dc && dc.send(JSON.stringify({ type: 'QueueAnimation', content: 'IdleOnSill'}))}