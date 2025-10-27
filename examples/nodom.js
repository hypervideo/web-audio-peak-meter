const audioCtx = new AudioContext();
const audioElement = document.getElementById('the-audio');
const clearPeaks = document.getElementById('clear-peaks');
const getPeaks = document.getElementById('get-peaks');
const currentFloat = document.getElementById('current-float');
const currentDB = document.getElementById('current-db');
const maxesFloat = document.getElementById('maxes-float');
const maxesDB = document.getElementById('maxes-db');

const sourceNode = audioCtx.createMediaElementSource(audioElement);
sourceNode.connect(audioCtx.destination);

const ctxStatus = document.getElementById('ctx-status');
const buttonElement = document.getElementById('ctx-button');

function updateAudioCtxStatus() {
  ctxStatus.innerText = audioCtx.state;
  if (audioCtx.state === 'suspended') {
    buttonElement.innerText = 'Resume';
  } else {
    buttonElement.innerText = 'Suspend';
  }
}

setInterval(updateAudioCtxStatus, 1000);

buttonElement.addEventListener('click', () => {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().then(updateAudioCtxStatus);
  } else {
    audioCtx.suspend().then(updateAudioCtxStatus);
  }
});

const meterInstance = new webAudioPeakMeter.WebAudioPeakMeter(sourceNode, (volume) => {
  console.log('Volume callback:', volume);
}, {
  peakCallbackDelay: 'immediate',
  peakHoldDuration: 5000,
  peakCallbackNormalizeVolume: {
    dbRangeMin: -48,
    dbRangeMax: 0,
    normalizedRangeMin: 0,
    normalizedRangeMax: 100,
  },
});

clearPeaks.addEventListener('click', () => {
  meterInstance.clearPeaks();
});

const displayFloatArray = (arr) => arr.map((val) => val.toFixed(2)).join(', ');

getPeaks.addEventListener('click', () => {
  const peaks = meterInstance.getPeaks();
  currentFloat.innerText = displayFloatArray(peaks.current.map(({ volume }) => volume));
  currentDB.innerText = displayFloatArray(peaks.currentDB);
  maxesFloat.innerText = displayFloatArray(peaks.maxes.map(({ volume }) => volume));
  maxesDB.innerText = displayFloatArray(peaks.maxesDB);
});
