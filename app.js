'use strict';

var wavesurfer, context, processor;
let fftw_plan_dft_r2c_1d;
let fftw_execute;
let fftw_destroy_plan;
let FFTW_ESTIMATE = (1 << 6);
let fft;


function loadFFT(cb) {
  fft = FFTWModule().then(function() {
    fftw_plan_dft_r2c_1d = fft.cwrap(
      'fftw_plan_dft_r2c_1d', 'number', ['number', 'number'
        , 'number', 'number']
    );
    fftw_execute = fft.cwrap(
      'fftw_execute', 'void', ['number']
    );
    fftw_destroy_plan = fft.cwrap(
      'fftw_destroy_plan', 'void', ['number']
    );
    cb();
  });
}

function doFFT(doubles, freq) {
  let src_ptr = fft._malloc(doubles.length * Float64Array.BYTES_PER_ELEMENT);
  let dst_ptr = fft._malloc(2 * (doubles.length / 2 + 1) * Float64Array.BYTES_PER_ELEMENT);


  let src = new Float64Array(fft.HEAPF64.buffer, src_ptr, doubles.length);
  let dst = new Float64Array(fft.HEAPF64.buffer, dst_ptr, doubles.length * 2);
  src.set(doubles);
  let plan = fftw_plan_dft_r2c_1d(doubles.length, src_ptr, dst_ptr, FFTW_ESTIMATE);

  fftw_execute(plan);
  fftw_destroy_plan(plan);
  let fftdata = new Array(2);
  fftdata[0] = new Array(doubles.length / 2 + 1);
  fftdata[1] = new Array(doubles.length / 2 + 1);
  let T = doubles.length / freq;
  for (let i = 0; i < doubles.length + 2; i += 2) {
    let val = Math.hypot(dst[i], dst[i + 1]) / (doubles.length / 2);
    let freq = i / 2 / T;
    fftdata[0][i / 2] = freq;
    fftdata[1][i / 2] = val;
  }
  fft._free(src_ptr);
  fft._free(dst_ptr);
  return fftdata;
}


function playVid() {
  context = new window.AudioContext();
  processor = context.createScriptProcessor(1024, 1, 1);
  // Init wavesurfer
  wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#0000ff',
    interact: false,
    cursorWidth: 0,
    audioContext: context || null,
    audioScriptProcessor: processor || null,
    plugins: [WaveSurfer.microphone.create()]
  });


  wavesurfer.microphone.on('deviceReady', function() {
    console.info('Device ready!');

  });
  wavesurfer.microphone.on('deviceError', function(code) {
    console.warn('Device error: ' + code);
  });
  wavesurfer.microphone.start();

  loadFFT(() => {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(handleSuccess);
  });
}




var handleSuccess = function(stream) {
  var source = context.createMediaStreamSource(stream);
  var processor = context.createScriptProcessor(1024, 1, 1);

  source.connect(processor);
  processor.connect(context.destination);
  processor.onaudioprocess = function(e) {
    if (e.inputBuffer.getChannelData(0).length) {
      drawFFTGraph(e.inputBuffer.getChannelData(0), 48000)
    }
  };
};

let threshold = 0.00002;
function cleanNoise(data) {
  var i = data[0].length;
  while (i--) {
    if (data[1][i] < threshold) {
      data[0].splice(i, 1);
      data[1].splice(i, 1);
    }
  }
}

function addMax(data) {
  data[0].unshift(0);
  data[1].unshift(0.3);
}

function drawFFTGraph(audioBuffer, freq) {
  let data = doFFT(audioBuffer, freq);
  //cleanNoise(data);
  //addMax(data);
  var dom = document.getElementById("container");
  var myChart = echarts.init(dom);
  myChart.setOption(getGraphOptions(data), true);
}

function getGraphOptions(data) {
  return {
    xAxis: {
      data: data[0]
    },
    yAxis: {
      splitArea: {
        show: false
      }
    },
    series: [{
      type: 'bar',
      data: data[1],
      animation: false,
      color: '#0000ff'
    },
      {
        type: 'bar',
        data: [0.3],
        animation: false,
        color: 'white'
      }],
  };
}