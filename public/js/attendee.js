/* See also:
    http://www.html5rocks.com/en/tutorials/webrtc/basics/
    https://code.google.com/p/webrtc-samples/source/browse/trunk/apprtc/index.html

    https://webrtc-demos.appspot.com/html/pc1.html
*/

window.sendAnimationState = (objectName, stateName) => {
  if (dc1 && dc1.readyState === "open") {
    dc1.send(JSON.stringify({ type: "AnimationEvent", objectName, stateName }));
  }
};

const iceTimeout = 5 * 1000;

async function waitForAnswer() {
  console.log("Waiting for answer...");
  try {
    let response = await fetch("/answer/audio");
    if (response.ok) {
      let desc = await response.json();
      if (desc.type === 1) {
        desc.type = "answer";
      }
      var answerDesc = new RTCSessionDescription(desc);
      handleAnswerFromPC2(answerDesc);
    } else {
      setTimeout(waitForAnswer, 1000);
    }
  } catch (e) {
    console.error("UHOH", e);
    setTimeout(waitForAnswer, 1000);
  }
}

var cfg = {
    iceServers: [
      {
        urls: ["stun:stun.l.google.com:19302"],
      },
      {
        urls: ["turn:turn.mayfly.live"],
        credential: "world",
        username: "hello",
      },
    ],
  },
  con = { optional: [{ DtlsSrtpKeyAgreement: true }] };

/* THIS IS ALICE, THE CALLER/SENDER */

var pc1 = new RTCPeerConnection(cfg, con),
  pc1IceDone = false,
  dc1 = null,
  activedc = null;

var sdpConstraints = {
  optional: [],
  mandatory: {
    OfferToReceiveAudio: true,
    OfferToReceiveVideo: false,
  },
};

requestAnimationFrame(createLocalOffer);

async function createLocalOffer() {
  console.log("video1");
  try {
    let stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });

    var video = document.getElementById("localVideo");
    video.srcObject = stream;
    video.play();

    stream.getTracks().forEach(function (track) {
      pc1.addTrack(track, stream);
    });
    console.log(stream);
    console.log("adding stream to pc1");
    setupDC1();
    try {
      const desc = await pc1.createOffer(sdpConstraints);
      pc1.setLocalDescription(desc);
      console.log("created local offer", desc);
      setTimeout(pc1SendOffer, iceTimeout);
    } catch (error) {
      console.warn("Couldn't create offer", error);
    }
  } catch (error) {
    console.log("Error adding stream to pc1: " + error);
  }
}

function setupDC1() {
  try {
    dc1 = pc1.createDataChannel("test", { reliable: true });
    activedc = dc1;
    console.log("Created datachannel (pc1)");
    dc1.onopen = function (e) {
      console.log("data channel connect");
    };
    dc1.onmessage = function (e) {
      console.log("Got message (pc1)", e.data);
      window.Unity.call(e.data);
    };
  } catch (e) {
    console.warn("No data channel (pc1)", e);
  }
}

pc1.onicecandidate = async (e) => {
  console.log(`ICE candidate (pc1) ${e.candidate && e.candidate.candidate}`);
  if (e.candidate == null) {
    pc1SendOffer();
  }
};

async function pc1SendOffer() {
  if (!pc1IceDone) {
    pc1IceDone = true;
    let body = JSON.stringify({
      type: "offer",
      sdp: pc1.localDescription.sdp,
    });
    await fetch("/offer/audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });
    waitForAnswer();
  }
}

function handleOnaddtrack(e) {
  console.log("Got remote track", e);
  var el = document.getElementById("remoteAudio");
  el.autoplay = true;
  el.srcObject = e.streams[0];
}

pc1.ontrack = handleOnaddtrack;

function onsignalingstatechange(state) {
  console.info("signaling state change:", state);
}

function oniceconnectionstatechange(state) {
  console.info("ice connection state change:", state);
}

function onicegatheringstatechange(state) {
  console.info("ice gathering state change:", state);
}

pc1.onsignalingstatechange = onsignalingstatechange;
pc1.oniceconnectionstatechange = oniceconnectionstatechange;
pc1.onicegatheringstatechange = onicegatheringstatechange;

function handleAnswerFromPC2(answerDesc) {
  console.log("Received remote answer: ", answerDesc);
  pc1.setRemoteDescription(answerDesc);
}

function handleCandidateFromPC2(iceCandidate) {
  pc1.addIceCandidate(iceCandidate);
}

setTimeout(() => {
  if (
    window &&
    window.webkit &&
    window.webkit.messageHandlers &&
    window.webkit.messageHandlers.unityControl
  ) {
    console.log("OHYEAH");
    window.Unity = {
      call: function (msg) {
        window.webkit.messageHandlers.unityControl.postMessage(msg);
      },
    };
  } else {
    window.Unity = {
      call: function (msg) {
        console.log("NO UNITY PARENT TO RECEIVE", msg);
        // window.location = 'unity:' + msg;
      },
    };
  }
}, 100);
